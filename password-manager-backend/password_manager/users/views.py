import json
from time import time

from django.conf import settings
from django.contrib.auth import login, logout
from django.contrib.auth.hashers import make_password
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.middleware.csrf import get_token, rotate_token
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.debug import sensitive_post_parameters
from rest_framework import generics
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import biometrics
from .models import CustomUser, Password, BiometricTemplate
from .permissions import VaultUnlocked
from .serializers import (
    UserSignupSerializer,
    LoginSerializer,
    PasswordConfirmationSerializer,
    UserSerializer,
    PasswordSerializer,
    PasswordReadSerializer,
)


def csrf_failure(request, reason=""):
    return JsonResponse(
        {"detail": "CSRF verification failed. Reload and try again."}, status=403
    )


def health(request):
    return JsonResponse({"status": "ok"})


@method_decorator(sensitive_post_parameters("password", "image"), name="dispatch")
@method_decorator(csrf_protect, name="dispatch")
class ProtectedAPIView(APIView):
    """Enforce CSRF even on anonymous login/signup endpoints."""


class CSRFView(ProtectedAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({"csrfToken": get_token(request)})


class SignupView(ProtectedAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "signup"

    def post(self, request):
        serializer = UserSignupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                serializer.save()
        except IntegrityError:
            return Response(
                {"detail": "Unable to register with these details."}, status=400
            )
        return Response({"message": "Account created. Please log in."}, status=201)


class LoginView(ProtectedAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = "login"

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = CustomUser.objects.filter(
            email__iexact=serializer.validated_data["email"].strip()
        ).first()
        if not user:
            make_password(serializer.validated_data["password"])
        if (
            not user
            or not user.check_password(serializer.validated_data["password"])
            or not user.is_active
        ):
            return Response({"detail": "Invalid credentials."}, status=401)
        request.session.flush()
        login(request, user, backend="django.contrib.auth.backends.ModelBackend")
        request.session["login_at"] = time()
        return Response(
            {"user": UserSerializer(user).data, "csrfToken": get_token(request)}
        )


class LogoutView(ProtectedAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        logout(request)
        rotate_token(request)
        return Response({"message": "Logged out.", "csrfToken": get_token(request)})


class UserDetailView(ProtectedAPIView):
    def get(self, request):
        data = UserSerializer(request.user).data
        data.update(
            {
                "face_enrolled": BiometricTemplate.objects.filter(
                    user=request.user
                ).exists(),
                "vault_unlocked": VaultUnlocked().has_permission(request, self),
            }
        )
        return Response(data)


class LockView(ProtectedAPIView):
    def post(self, request):
        clear_temporary_authorization(request)
        return Response({"message": "Vault locked."})


def clear_temporary_authorization(request):
    for key in (
        "vault_until",
        "vault_factor",
        "vault_face_version",
        "face_enrollment_password_confirmed_until",
    ):
        request.session.pop(key, None)


class ConfirmPasswordView(ProtectedAPIView):
    throttle_scope = "password_confirm"

    def post(self, request):
        request.session.pop("face_enrollment_password_confirmed_until", None)
        serializer = PasswordConfirmationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # Serialize enrollment/confirmation for this account; never select a user
        # from client-supplied email or username fields.
        with transaction.atomic():
            CustomUser.objects.select_for_update().get(pk=request.user.pk)
            if not request.user.check_password(serializer.validated_data["password"]):
                return Response({"detail": "Password confirmation failed."}, status=400)
            if BiometricTemplate.objects.filter(user=request.user).exists():
                return Response(
                    {
                        "detail": "Verify your current face before replacing face enrollment."
                    },
                    status=403,
                )
            request.session["face_enrollment_password_confirmed_until"] = (
                time() + settings.FACE_ENROLLMENT_CONFIRM_SECONDS
            )
        return Response(
            {
                "message": "Password confirmed. Set up face verification within five minutes."
            }
        )


class PasswordListView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, VaultUnlocked]

    def get_queryset(self):
        return Password.objects.filter(user=self.request.user).order_by("pk")

    def get_serializer_class(self):
        return (
            PasswordReadSerializer
            if self.request.method == "GET"
            else PasswordSerializer
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class PasswordDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated, VaultUnlocked]

    def get_queryset(self):
        return Password.objects.filter(user=self.request.user)

    def get_serializer_class(self):
        return (
            PasswordReadSerializer
            if self.request.method == "GET"
            else PasswordSerializer
        )


class FaceStatusView(ProtectedAPIView):
    def get(self, request):
        return Response(
            {"enrolled": BiometricTemplate.objects.filter(user=request.user).exists()}
        )


class FaceEnrollView(ProtectedAPIView):
    throttle_scope = "face"

    def post(self, request):
        # Recheck authorization while holding the account lock so two concurrent
        # first-enrollment requests cannot silently become a replacement.
        with transaction.atomic():
            CustomUser.objects.select_for_update().get(pk=request.user.pk)
            template = BiometricTemplate.objects.filter(user=request.user).first()
            if template is None:
                if (
                    request.session.get("face_enrollment_password_confirmed_until", 0)
                    <= time()
                ):
                    raise PermissionDenied(
                        "Confirm your password before setting up face verification."
                    )
            else:
                request.session.pop("face_enrollment_password_confirmed_until", None)
                if not VaultUnlocked().has_permission(request, self):
                    raise PermissionDenied(
                        "Verify your current face before replacing face enrollment."
                    )
            encoding = biometrics.extract_encoding(request.FILES.get("image"))
            BiometricTemplate.objects.update_or_create(
                user=request.user, defaults={"encoding": json.dumps(encoding)}
            )
            clear_temporary_authorization(request)
        return Response(
            {
                "message": "Face verification is set up. Verify your face to unlock the vault."
            },
            status=201,
        )


class FaceVerifyView(ProtectedAPIView):
    throttle_scope = "face"

    def post(self, request):
        clear_temporary_authorization(request)
        with transaction.atomic():
            CustomUser.objects.select_for_update().get(pk=request.user.pk)
            template = BiometricTemplate.objects.filter(user=request.user).first()
            if template is None:
                return Response(
                    {"detail": "Set up face verification before unlocking your vault."},
                    status=404,
                )
            encoding = biometrics.extract_encoding(request.FILES.get("image"))
            if not biometrics.matches(template.encoding, encoding):
                return Response({"detail": "Face verification failed."}, status=400)
            request.session["vault_until"] = time() + settings.VAULT_UNLOCK_SECONDS
            request.session["vault_factor"] = "face"
            request.session["vault_face_version"] = template.updated_at.isoformat()
        return Response({"message": "Vault unlocked for five minutes."})
