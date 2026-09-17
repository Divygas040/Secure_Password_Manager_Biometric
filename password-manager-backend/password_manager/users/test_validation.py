"""Validation boundaries and mocked HTTPS mail transport; never sends real mail."""

import json
import os
import subprocess
import sys
from datetime import timedelta
from unittest.mock import patch

import requests
from django.conf import settings
from django.test import TestCase, SimpleTestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient, APIRequestFactory

from .fields import decrypt
from .models import CustomUser, RateLimitBucket
from .serializers import (
    UserSignupSerializer,
    LoginSerializer,
    OTPSerializer,
    PasswordSerializer,
)
from .throttles import DatabaseThrottle, RATES


class InputValidationTests(TestCase):
    def signup(self, **changes):
        return UserSignupSerializer(
            data={
                "username": "TestUser",
                "email": "test@example.invalid",
                "phone": "1234567890",
                "password": "Strong-fixture-password!42",
                **changes,
            }
        )

    def test_username_limits_characters_and_trim(self):
        for value in ["ab", "a" * 31, "Full Name", "a/b", "Test😀", "Ｔｅｓｔ"]:
            with self.subTest(value=value):
                s = self.signup(username=value)
                self.assertFalse(s.is_valid())
                self.assertIn("username", s.errors)
        for value in ["abc", "a" * 30, "  User@.+-_42  "]:
            s = self.signup(username=value)
            self.assertTrue(s.is_valid(), s.errors)
            self.assertEqual(s.validated_data["username"], value.strip())

    def test_unique_username_phone_email_have_generic_errors(self):
        self.signup().is_valid(raise_exception=True)
        CustomUser.objects.create_user(
            "TestUser", email="test@example.invalid", phone="1234567890"
        )
        s = self.signup(email=" TEST@example.invalid ")
        self.assertFalse(s.is_valid())
        for field in ["username", "email", "phone"]:
            self.assertEqual(
                str(s.errors[field][0]), "Unable to register with these details."
            )

    def test_phone_ascii_digits_and_boundaries(self):
        for value in [
            "1" * 9,
            "1" * 16,
            "１２３４５６７８９０",
            "123 4567890",
            "+1234567890",
            "1234567890\n",
            " 1234567890",
        ]:
            s = self.signup(phone=value)
            self.assertFalse(s.is_valid())
            self.assertIn("phone", s.errors)
        for value in ["1" * 10, "1" * 15]:
            s = self.signup(phone=value)
            self.assertTrue(s.is_valid(), s.errors)

    def test_email_normalization_format_and_length(self):
        # A syntactically valid 254-character email, then one character over.
        maximum = "a" * 64 + "@" + "b" * 63 + "." + "c" * 63 + "." + "d" * 57 + ".com"
        self.assertEqual(len(maximum), 254)
        for cls in [
            self.signup,
            lambda **data: LoginSerializer(data={"password": "x", **data}),
        ]:
            for value in ["", "bad", "a@@example.com", maximum + "x"]:
                s = cls(email=value)
                self.assertFalse(s.is_valid())
                self.assertIn("email", s.errors)
            for value in [maximum, " TEST@EXAMPLE.INVALID "]:
                s = cls(email=value)
                self.assertTrue(s.is_valid(), s.errors)
                self.assertEqual(s.validated_data["email"], value.strip().lower())

    def test_signup_password_limits_strength_and_exact_whitespace(self):
        for value in ["", "Q!4v" * 2, "Q!4v" * 33, "123456789012"]:
            s = self.signup(password=value)
            self.assertFalse(s.is_valid())
            self.assertIn("password", s.errors)
        for value in ["Q!4v" * 3, "Q!4v" * 32, "  Q!4v  x4Q!  "]:
            s = self.signup(password=value)
            self.assertTrue(s.is_valid(), s.errors)
            self.assertEqual(s.validated_data["password"], value)

    def test_login_password_does_not_require_signup_strength(self):
        for value in ["x", "  existing  ", "x" * 128]:
            s = LoginSerializer(
                data={"email": "test@example.invalid", "password": value}
            )
            self.assertTrue(s.is_valid(), s.errors)
            self.assertEqual(s.validated_data["password"], value)
        for value in ["", "x" * 129]:
            s = LoginSerializer(
                data={"email": "test@example.invalid", "password": value}
            )
            self.assertFalse(s.is_valid())
            self.assertIn("password", s.errors)

    def test_otp_requires_exactly_six_ascii_digits(self):
        for value in [
            "",
            "12345",
            "1234567",
            "１２３４５６",
            "12345a",
            "123456\n",
            " 123456",
        ]:
            s = OTPSerializer(data={"otp": value})
            self.assertFalse(s.is_valid())
            self.assertIn("otp", s.errors)
        self.assertTrue(OTPSerializer(data={"otp": "123456"}).is_valid())

    def test_vault_names_and_password_preservation(self):
        for value in ["", "  ", "a" * 256, "\u200b\u200d", "\x01\x02"]:
            s = PasswordSerializer(data={"domain_name": value, "password": "x"})
            self.assertFalse(s.is_valid())
            self.assertIn("domain_name", s.errors)
        user = CustomUser.objects.create_user(
            "owner", email="owner@example.invalid", phone="1234567890"
        )
        for value in ["x", "  existing secret  ", " " * 3, "x" * 4096]:
            s = PasswordSerializer(
                data={"domain_name": "  École / Work & Home 🔒  ", "password": value}
            )
            self.assertTrue(s.is_valid(), s.errors)
            p = s.save(user=user)
            p.refresh_from_db()
            self.assertEqual(decrypt(p.password), value)
            self.assertEqual(p.domain_name, "École / Work & Home 🔒")
        s = PasswordSerializer(data={"domain_name": "x" * 255, "password": "x"})
        self.assertTrue(s.is_valid(), s.errors)
        for value in ["", "x" * 4097]:
            s = PasswordSerializer(data={"domain_name": "Service", "password": value})
            self.assertFalse(s.is_valid())
            self.assertIn("password", s.errors)

    def test_vault_link_optional_and_http_only(self):
        for value in ["", " https://example.com/path?q=yes ", "http://example.com"]:
            s = PasswordSerializer(
                data={"domain_name": "Service", "password": "weak", "link": value}
            )
            self.assertTrue(s.is_valid(), s.errors)
            self.assertEqual(s.validated_data["link"], value.strip())
        for value in [
            "ftp://example.com",
            "javascript:alert(1)",
            "https://",
            "not-a-url",
            "https://example.com/" + "a" * 201,
        ]:
            s = PasswordSerializer(
                data={"domain_name": "Service", "password": "weak", "link": value}
            )
            self.assertFalse(s.is_valid())
            self.assertIn("link", s.errors)

    def test_api_field_errors_and_generic_invalid_login(self):
        client = APIClient()
        response = client.post(
            "/api/users/signup/",
            {
                "username": "Full Name",
                "phone": "bad",
                "email": "bad",
                "password": "short",
            },
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(set(response.data), {"username", "phone", "email", "password"})
        response = client.post(
            "/api/users/login/", {"email": "unknown@example.invalid", "password": "x"}
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.data, {"detail": "Invalid credentials."})


@override_settings(
    EMAIL_BACKEND="anymail.backends.resend.EmailBackend",
    DEFAULT_FROM_EMAIL="BioPass <security@biopassmanager.online>",
)
class ResendDeliveryTests(TestCase):
    def setUp(self):
        # No provider key is needed: HTTP is mocked before sending any request.
        self.mail_settings = override_settings(
            ANYMAIL={"RESEND_API_KEY": "", "REQUESTS_TIMEOUT": 15}
        )
        self.mail_settings.enable()
        self.addCleanup(self.mail_settings.disable)
        self.user = CustomUser.objects.create_user(
            "mail-user",
            email="mail@example.invalid",
            phone="1234567890",
            password="Transport-fixture!42",
        )
        self.client = APIClient()
        result = self.client.post(
            "/api/users/login/",
            {"email": self.user.email, "password": "Transport-fixture!42"},
        )
        self.assertEqual(result.status_code, 200)

    def test_send_mail_uses_resend_https_and_preserves_otp_flow(self):
        response = requests.Response()
        response.status_code = 200
        response._content = b'{"id":"mock-message-id"}'
        with patch("requests.Session.request", return_value=response) as transport:
            result = self.client.post("/api/users/send-otp-email/")
        self.assertEqual(result.status_code, 200)
        params = transport.call_args.kwargs
        self.assertEqual(params["url"], "https://api.resend.com/emails")
        self.assertEqual(params["timeout"], 15)
        payload = json.loads(params["data"])
        self.assertEqual(payload["from"], settings.DEFAULT_FROM_EMAIL)
        self.assertEqual(payload["to"], [self.user.email])
        import re

        code = re.search(r"\b[0-9]{6}\b", payload["text"]).group()
        self.assertNotIn(code, result.content.decode())
        self.user.refresh_from_db()
        self.assertNotEqual(self.user.otp_digest, code)
        self.assertTrue(self.user.otp_session)
        self.assertIsNone(self.user.otp_generated)
        self.assertEqual(
            self.client.post("/api/users/verify-otp/", {"otp": code}).status_code, 200
        )
        self.assertEqual(
            self.client.post("/api/users/verify-otp/", {"otp": code}).status_code, 400
        )

    def test_resend_http_failure_is_generic_and_invalidates_challenge(self):
        response = requests.Response()
        response.status_code = 403
        response._content = b'{"message":"private-provider-detail"}'
        with patch("requests.Session.request", return_value=response):
            result = self.client.post("/api/users/send-otp-email/")
        self.assertEqual(result.status_code, 503)
        self.assertEqual(
            result.data, {"detail": "Email could not be delivered. Try again later."}
        )
        self.user.refresh_from_db()
        self.assertEqual(self.user.otp_digest, "")
        self.assertIsNone(self.user.otp_expires_at)

    @override_settings(CORS_ALLOWED_ORIGINS=["https://www.biopassmanager.online"])
    def test_cooldown_reports_remaining_seconds(self):
        now = timezone.now()
        self.user.otp_sent_at = now - timedelta(seconds=45)
        self.user.save(update_fields=["otp_sent_at"])
        with patch("users.views.timezone.now", return_value=now):
            response = self.client.post(
                "/api/users/send-otp-email/",
                HTTP_ORIGIN="https://www.biopassmanager.online",
            )
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response["Retry-After"], "15")
        self.assertIn("Retry-After", response["Access-Control-Expose-Headers"])
        self.assertEqual(response.data["retry_after"], 15)


class ThrottleWaitTests(TestCase):
    def test_remaining_window_and_reset(self):
        from django.contrib.auth.models import AnonymousUser
        from types import SimpleNamespace

        request = APIRequestFactory().get("/")
        request.user = AnonymousUser()
        view = SimpleNamespace(throttle_scope="api")
        now = timezone.now()
        throttle = DatabaseThrottle()
        with patch("users.throttles.timezone.now", return_value=now):
            self.assertTrue(throttle.allow_request(request, view))
        RateLimitBucket.objects.update(count=RATES["api"][0])
        with patch(
            "users.throttles.timezone.now", return_value=now + timedelta(seconds=47)
        ):
            self.assertFalse(throttle.allow_request(request, view))
            self.assertEqual(throttle.wait(), 13)
        with patch(
            "users.throttles.timezone.now", return_value=now + timedelta(seconds=60)
        ):
            self.assertTrue(throttle.allow_request(request, view))


class EmailSettingsTests(SimpleTestCase):
    def test_missing_resend_key_and_unsafe_production_backends_fail_closed(self):
        base = {
            **os.environ,
            "DJANGO_SECRET_KEY": settings.SECRET_KEY,
            "VAULT_ENCRYPTION_KEY": settings.VAULT_ENCRYPTION_KEY,
            "BIOMETRIC_ENCRYPTION_KEY": settings.BIOMETRIC_ENCRYPTION_KEY,
            "DEBUG": "False",
            "ALLOWED_HOSTS": "api.example.com",
            "CORS_ALLOWED_ORIGINS": "https://example.com",
            "CSRF_TRUSTED_ORIGINS": "https://example.com",
            "DATABASE_URL": "postgres://localhost/unused",
            "RESEND_API_KEY": "",
        }
        for backend in [
            "anymail.backends.resend.EmailBackend",
            "django.core.mail.backends.console.EmailBackend",
            "django.core.mail.backends.dummy.EmailBackend",
            "django.core.mail.backends.locmem.EmailBackend",
        ]:
            result = subprocess.run(
                [sys.executable, "-c", "import password_manager.settings"],
                cwd=settings.BASE_DIR,
                env={**base, "EMAIL_BACKEND": backend},
                capture_output=True,
            )
            self.assertNotEqual(result.returncode, 0)
        result = subprocess.run(
            [sys.executable, "-c", "import password_manager.settings"],
            cwd=settings.BASE_DIR,
            env={
                **base,
                "DEBUG": "True",
                "EMAIL_BACKEND": "django.core.mail.backends.console.EmailBackend",
            },
            capture_output=True,
        )
        self.assertEqual(
            result.returncode, 0, "Local console configuration failed; output withheld."
        )
