import json
import secrets
from datetime import timedelta
from time import time

from django.conf import settings
from django.contrib.auth import login, logout
from django.contrib.auth.hashers import make_password
from django.core.mail import send_mail
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.middleware.csrf import get_token, rotate_token
from django.utils import timezone
from django.utils.crypto import constant_time_compare, salted_hmac
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.debug import sensitive_post_parameters
from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import biometrics
from .models import CustomUser, Password, BiometricTemplate
from .permissions import VaultUnlocked, OTPVerified
from .serializers import UserSignupSerializer, LoginSerializer, OTPSerializer, UserSerializer, PasswordSerializer, PasswordReadSerializer


def csrf_failure(request, reason=''):
    return JsonResponse({'detail': 'CSRF verification failed. Reload and try again.'}, status=403)


def health(request):
    return JsonResponse({'status': 'ok'})


@method_decorator(sensitive_post_parameters('password', 'otp', 'image'), name='dispatch')
@method_decorator(csrf_protect, name='dispatch')
class ProtectedAPIView(APIView):
    """Enforce CSRF even on anonymous login/signup endpoints."""

class CSRFView(ProtectedAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    def get(self, request):
        return Response({'csrfToken': get_token(request)})

class SignupView(ProtectedAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = 'signup'
    def post(self, request):
        serializer = UserSignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                serializer.save()
        except IntegrityError:
            return Response({'detail': 'Unable to register with these details.'}, status=400)
        return Response({'message': 'Account created. Please log in.'}, status=201)

class LoginView(ProtectedAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = 'login'
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = CustomUser.objects.filter(email__iexact=serializer.validated_data['email'].strip()).first()
        if not user:
            make_password(serializer.validated_data['password'])
        if not user or not user.check_password(serializer.validated_data['password']) or not user.is_active:
            return Response({'detail': 'Invalid credentials.'}, status=401)
        request.session.flush()
        login(request, user, backend='django.contrib.auth.backends.ModelBackend')
        request.session['login_at'] = time()
        return Response({'user': UserSerializer(user).data, 'csrfToken': get_token(request)})

class LogoutView(ProtectedAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    def post(self, request):
        logout(request)
        rotate_token(request)
        return Response({'message': 'Logged out.', 'csrfToken': get_token(request)})

class UserDetailView(ProtectedAPIView):
    def get(self, request):
        data = UserSerializer(request.user).data
        data.update({'face_enrolled': BiometricTemplate.objects.filter(user=request.user).exists(),
                     'vault_unlocked': VaultUnlocked().has_permission(request, self)})
        return Response(data)

class LockView(ProtectedAPIView):
    def post(self, request):
        request.session.pop('vault_until', None)
        request.session.pop('vault_factor', None)
        return Response({'message': 'Vault locked.'})


def session_digest(request):
    return salted_hmac('otp-session', request.session.session_key or '').hexdigest()

def otp_digest(user_id, session, code):
    return salted_hmac('vault-email-code', f'{user_id}:{session}:{code}', algorithm='sha256').hexdigest()

def unlock(request, factor):
    request.session['vault_until'] = time() + settings.VAULT_UNLOCK_SECONDS
    request.session['vault_factor'] = factor

class SendOTPView(ProtectedAPIView):
    throttle_scope = 'otp_send'
    def post(self, request):
        now = timezone.now()
        with transaction.atomic():
            user = CustomUser.objects.select_for_update().get(pk=request.user.pk)
            if user.otp_sent_at and (now - user.otp_sent_at).total_seconds() < settings.OTP_RESEND_SECONDS:
                return Response({'detail': 'Wait before requesting another code.'}, status=429)
            code = f'{secrets.randbelow(1_000_000):06d}'
            user.otp_session = session_digest(request)
            user.otp_digest = otp_digest(user.pk, user.otp_session, code)
            user.otp_expires_at = now + timedelta(seconds=settings.OTP_TTL_SECONDS)
            user.otp_sent_at, user.otp_attempts = now, 0
            user.otp_secret = user.otp_generated = None
            user.save(update_fields=['otp_session', 'otp_digest', 'otp_expires_at', 'otp_sent_at', 'otp_attempts', 'otp_secret', 'otp_generated'])
            digest = user.otp_digest
        try:
            delivered = send_mail('Your BioPass verification code', f'Your verification code is {code}. It expires in five minutes.',
                                 settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)
            if delivered != 1:
                raise RuntimeError
        except Exception:
            CustomUser.objects.filter(pk=user.pk, otp_digest=digest).update(otp_digest='', otp_expires_at=None)
            return Response({'detail': 'Email could not be delivered. Try again later.'}, status=503)
        return Response({'message': 'A verification code has been sent.'})

class VerifyOTPView(ProtectedAPIView):
    throttle_scope = 'otp_verify'
    def post(self, request):
        serializer = OTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            user = CustomUser.objects.select_for_update().get(pk=request.user.pk)
            valid = (user.otp_digest and user.otp_expires_at and user.otp_expires_at > timezone.now()
                     and user.otp_attempts < settings.OTP_MAX_ATTEMPTS
                     and constant_time_compare(user.otp_session, session_digest(request))
                     and constant_time_compare(user.otp_digest, otp_digest(user.pk, user.otp_session, serializer.validated_data['otp'])))
            user.otp_attempts = min(user.otp_attempts + 1, settings.OTP_MAX_ATTEMPTS)
            if valid or user.otp_attempts >= settings.OTP_MAX_ATTEMPTS:
                user.otp_digest, user.otp_expires_at = '', None
            user.save(update_fields=['otp_attempts', 'otp_digest', 'otp_expires_at'])
        if not valid:
            return Response({'detail': 'Invalid or expired verification code.'}, status=400)
        unlock(request, 'otp')
        return Response({'message': 'Vault unlocked for five minutes.'})

class PasswordListView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, VaultUnlocked]
    def get_queryset(self):
        return Password.objects.filter(user=self.request.user).order_by('pk')
    def get_serializer_class(self):
        return PasswordReadSerializer if self.request.method == 'GET' else PasswordSerializer
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

class PasswordDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated, VaultUnlocked]
    def get_queryset(self):
        return Password.objects.filter(user=self.request.user)
    def get_serializer_class(self):
        return PasswordReadSerializer if self.request.method == 'GET' else PasswordSerializer

class FaceStatusView(ProtectedAPIView):
    def get(self, request):
        return Response({'enrolled': BiometricTemplate.objects.filter(user=request.user).exists()})

class FaceEnrollView(ProtectedAPIView):
    permission_classes = [IsAuthenticated, OTPVerified]
    throttle_scope = 'face'
    def post(self, request):
        encoding = biometrics.extract_encoding(request.FILES.get('image'))
        with transaction.atomic():
            CustomUser.objects.select_for_update().get(pk=request.user.pk)
            BiometricTemplate.objects.update_or_create(user=request.user, defaults={'encoding': json.dumps(encoding)})
        return Response({'message': 'Face verification enrolled.'}, status=201)

class FaceVerifyView(ProtectedAPIView):
    throttle_scope = 'face'
    def post(self, request):
        template = BiometricTemplate.objects.filter(user=request.user).first()
        if template is None:
            return Response({'detail': 'No face template enrolled. Use an email code.'}, status=404)
        encoding = biometrics.extract_encoding(request.FILES.get('image'))
        if not biometrics.matches(template.encoding, encoding):
            return Response({'detail': 'Face verification failed. Try an email code.'}, status=400)
        unlock(request, 'face')
        return Response({'message': 'Vault unlocked for five minutes.'})
