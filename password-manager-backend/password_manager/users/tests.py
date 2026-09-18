import json
from io import BytesIO
from time import time
from unittest.mock import patch

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from django.test import TestCase, override_settings
from PIL import Image as PILImage
from rest_framework.test import APIClient

from .fields import Ciphertext, decrypt
from .models import CustomUser, Password, BiometricTemplate, RateLimitBucket, Image
from .biometrics import extract_encoding

PASS = "Unit-test-password!42"


class SecurityTests(TestCase):
    def setUp(self):
        self.a = CustomUser.objects.create_user(
            "alice", email="alice@example.invalid", phone="12345678901", password=PASS
        )
        self.b = CustomUser.objects.create_user(
            "bob", email="bob@example.invalid", phone="12345678902", password=PASS
        )
        self.client = APIClient()
        self.login()

    def login(self, client=None, email="alice@example.invalid"):
        client = client or self.client
        result = client.post(
            "/api/users/login/", {"email": email, "password": PASS}, format="json"
        )
        self.assertEqual(result.status_code, 200)
        self.assertNotIn("token", result.data)
        self.assertNotIn("refresh", result.data)
        return result

    def unlock(self, client=None):
        client = client or self.client
        user = CustomUser.objects.get(pk=client.session["_auth_user_id"])
        BiometricTemplate.objects.get_or_create(
            user=user, defaults={"encoding": json.dumps([0.1] * 128)}
        )
        with patch("users.biometrics.extract_encoding", return_value=[0.1] * 128):
            self.assertEqual(
                client.post(
                    "/api/users/verify-face/",
                    {"image": SimpleUploadedFile("face.png", b"fixture")},
                ).status_code,
                200,
            )

    def new_password(self, user=None, value="vault test credential"):
        return Password.objects.create(
            user=user or self.a,
            domain_name="Example",
            password=value,
            link="https://example.com",
        )

    def test_signup_hashes_login_password_and_requires_strong_password(self):
        data = {
            "username": "charlie",
            "phone": "12345678903",
            "email": "CHARLIE@example.invalid",
            "password": PASS,
        }
        result = self.client.post("/api/users/signup/", data, format="json")
        self.assertEqual(result.status_code, 201)
        user = CustomUser.objects.get(username="charlie")
        self.assertTrue(user.check_password(PASS))
        self.assertNotEqual(user.password, PASS)
        self.assertEqual(user.email, data["email"].lower())
        data.update(
            username="weak",
            phone="12345678904",
            email="weak@example.invalid",
            password="password",
        )
        self.assertEqual(self.client.post("/api/users/signup/", data).status_code, 400)

    def test_duplicate_email_case_insensitive(self):
        r = self.client.post(
            "/api/users/signup/",
            {
                "username": "new",
                "phone": "12345678903",
                "email": "ALICE@example.invalid",
                "password": PASS,
            },
        )
        self.assertEqual(r.status_code, 400)

    def test_login_cookie_and_logout_revocation(self):
        cookie = self.client.cookies[settings.SESSION_COOKIE_NAME]
        self.assertTrue(cookie["httponly"])
        saved = cookie.value
        self.unlock()
        self.assertEqual(self.client.post("/api/users/logout/").status_code, 200)
        self.client.cookies[settings.SESSION_COOKIE_NAME] = saved
        self.assertEqual(self.client.get("/api/users/me/").status_code, 401)

    def test_session_absolute_expiry(self):
        session = self.client.session
        session["login_at"] = time() - 13 * 3600
        session.save()
        self.assertEqual(self.client.get("/api/users/me/").status_code, 401)

    def test_inactive_and_wrong_password_rejected(self):
        r = self.client.post(
            "/api/users/login/", {"email": self.a.email, "password": "wrong"}
        )
        self.assertEqual(r.status_code, 401)
        self.a.is_active = False
        self.a.save()
        r = self.client.post(
            "/api/users/login/", {"email": self.a.email, "password": PASS}
        )
        self.assertEqual(r.status_code, 401)

    def test_anonymous_endpoints_reject_access(self):
        anon = APIClient()
        for url in ["passwords/", "me/", "image/"]:
            self.assertEqual(anon.get("/api/users/" + url).status_code, 401)
        for url in ["image-upload/", "verify-face/", "confirm-password/"]:
            self.assertEqual(anon.post("/api/users/" + url).status_code, 401)

    def test_locked_vault_requires_server_verification(self):
        self.new_password()
        self.assertEqual(self.client.get("/api/users/passwords/").status_code, 403)
        self.assertEqual(
            self.client.post(
                "/api/users/passwords/", {"domain_name": "x", "password": "x"}
            ).status_code,
            403,
        )

    def test_database_ciphertext_authorized_retrieval(self):
        self.unlock()
        r = self.client.post(
            "/api/users/passwords/",
            {
                "domain_name": "Example",
                "password": "exact secret value",
                "link": "https://example.com",
            },
        )
        self.assertEqual(r.status_code, 201)
        self.assertNotIn("password", r.data)
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT password FROM users_password WHERE id = %s", [r.data["id"]]
            )
            raw = cursor.fetchone()[0]
        self.assertNotEqual(raw, "exact secret value")
        self.assertNotIn("exact secret value", raw)
        r = self.client.get("/api/users/passwords/")
        self.assertEqual(r.data[0]["password"], "exact secret value")
        self.assertEqual(r["Cache-Control"], "no-store, private")

    def test_cross_user_crud_isolated(self):
        other = self.new_password(self.b)
        self.unlock()
        self.assertEqual(self.client.get("/api/users/passwords/").data, [])
        url = f"/api/users/passwords/{other.pk}/"
        for method, kwargs in [
            ("get", {}),
            ("patch", {"data": {"password": "altered"}, "format": "json"}),
            ("delete", {}),
        ]:
            self.assertEqual(
                getattr(self.client, method)(url, **kwargs).status_code, 404
            )
        other.refresh_from_db()
        self.assertEqual(decrypt(other.password), "vault test credential")

    def test_update_encrypts_and_metadata_save_does_not_double_encrypt(self):
        p = self.new_password()
        p.refresh_from_db()
        cipher = p.password
        p.domain_name = "updated"
        p.save()
        p.refresh_from_db()
        self.assertEqual(p.password, cipher)
        self.unlock()
        r = self.client.patch(
            f"/api/users/passwords/{p.pk}/", {"password": "changed"}, format="json"
        )
        self.assertEqual(r.status_code, 200)
        p.refresh_from_db()
        self.assertEqual(decrypt(p.password), "changed")

    def test_ciphertext_looking_plaintext_is_not_accepted_as_pre_encrypted(self):
        value = "fernet:v1:literal-user-password"
        p = self.new_password(value=value)
        p.refresh_from_db()
        self.assertEqual(decrypt(p.password), value)

    def test_bulk_and_queryset_writes_encrypt(self):
        Password.objects.bulk_create(
            [Password(user=self.a, domain_name="bulk", password="bulk-secret")]
        )
        Password.objects.filter(user=self.a).update(password="updated-secret")
        p = Password.objects.get(user=self.a)
        self.assertEqual(decrypt(p.password), "updated-secret")
        self.assertNotEqual(p.password, "updated-secret")

    def test_wrong_key_and_tampering_fail_closed(self):
        p = self.new_password()
        p.refresh_from_db()
        with override_settings(VAULT_ENCRYPTION_KEY=Fernet.generate_key().decode()):
            with self.assertRaises(InvalidToken):
                decrypt(p.password)
        with self.assertRaises(InvalidToken):
            decrypt(Ciphertext(str(p.password)[:-8] + "invalid!"))

    def test_vault_grant_expiry_and_lock(self):
        self.unlock()
        session = self.client.session
        session["vault_until"] = time() - 1
        session.save()
        self.assertEqual(self.client.get("/api/users/passwords/").status_code, 403)
        session = self.client.session
        session["vault_until"] = time() + 300
        session.save()
        self.assertEqual(self.client.post("/api/users/lock/").status_code, 200)
        self.assertEqual(self.client.get("/api/users/passwords/").status_code, 403)

    def test_initial_enrollment_requires_password_confirmation_and_encrypts_template(
        self,
    ):
        image = lambda: SimpleUploadedFile("face.png", b"dummy")
        self.assertEqual(
            self.client.post(
                "/api/users/image-upload/", {"image": image()}
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.post(
                "/api/users/confirm-password/", {"password": PASS}
            ).status_code,
            200,
        )
        with patch("users.biometrics.extract_encoding", return_value=[0.1] * 128):
            self.assertEqual(
                self.client.post(
                    "/api/users/image-upload/", {"image": image()}
                ).status_code,
                201,
            )
        template = BiometricTemplate.objects.get(user=self.a)
        self.assertNotIn("[0.1", template.encoding)
        self.assertEqual(
            json.loads(decrypt(template.encoding, "BIOMETRIC_ENCRYPTION_KEY")),
            [0.1] * 128,
        )
        self.assertFalse(Image.objects.exists())
        self.assertEqual(self.client.get("/api/users/image/").data, {"enrolled": True})

        self.assertNotIn(
            "face_enrollment_password_confirmed_until", self.client.session
        )
        self.assertEqual(self.client.get("/api/users/passwords/").status_code, 403)
        # The consumed initial authorization cannot authorize replacement.
        self.assertEqual(self.client.post("/api/users/image-upload/").status_code, 403)

    def test_face_failure_does_not_unlock_or_expose_passwords(self):
        self.new_password()
        BiometricTemplate.objects.create(user=self.a, encoding=json.dumps([0.1] * 128))
        with patch("users.biometrics.extract_encoding", return_value=[1.0] * 128):
            r = self.client.post(
                "/api/users/verify-face/",
                {"image": SimpleUploadedFile("x.png", b"dummy")},
            )
        self.assertEqual(r.status_code, 400)
        self.assertNotIn("password", r.data)
        self.assertEqual(self.client.get("/api/users/passwords/").status_code, 403)

    def test_face_success_unlocks_only_own_vault(self):
        BiometricTemplate.objects.create(user=self.a, encoding=json.dumps([0.1] * 128))
        self.new_password()
        self.new_password(self.b)
        with patch("users.biometrics.extract_encoding", return_value=[0.1] * 128):
            r = self.client.post(
                "/api/users/verify-face/",
                {"image": SimpleUploadedFile("x.png", b"dummy")},
            )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(self.client.get("/api/users/passwords/").data), 1)

    def test_face_does_not_use_other_users_template(self):
        BiometricTemplate.objects.create(user=self.b, encoding=json.dumps([0.1] * 128))
        self.assertEqual(self.client.post("/api/users/verify-face/").status_code, 404)

    def test_real_detector_rejects_blank_image(self):
        out = BytesIO()
        PILImage.new("RGB", (64, 64)).save(out, format="PNG")
        with self.assertRaisesMessage(Exception, "exactly one"):
            extract_encoding(SimpleUploadedFile("blank.png", out.getvalue()))

    def test_image_size_content_and_pixel_validation(self):
        for upload in [
            None,
            SimpleUploadedFile("bad.png", b"not an image"),
            SimpleUploadedFile("big.png", b"x" * (2 * 1024 * 1024 + 1)),
        ]:
            with self.assertRaises(Exception):
                extract_encoding(upload)
        out = BytesIO()
        PILImage.new("RGB", (2100, 2100)).save(out, format="PNG")
        with self.assertRaises(Exception):
            extract_encoding(SimpleUploadedFile("pixels.png", out.getvalue()))

    def test_login_rate_limit(self):
        for _ in range(10):
            result = self.client.post(
                "/api/users/login/",
                {"email": "nobody@example.invalid", "password": "wrong"},
            )
        self.assertEqual(result.status_code, 429)

    def test_health_minimal_public_response(self):
        r = APIClient().get("/health/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {"status": "ok"})

    def test_legacy_readiness_guard(self):
        Image.objects.create(user=self.a, image_data=b"legacy")
        with self.assertRaises(CommandError):
            call_command("check_data_ready")

    def test_csrf_login_and_authenticated_mutations(self):
        client = APIClient(enforce_csrf_checks=True)
        self.assertEqual(
            client.post(
                "/api/users/login/", {"email": self.a.email, "password": PASS}
            ).status_code,
            403,
        )
        token = client.get("/api/users/csrf/").data["csrfToken"]
        r = client.post(
            "/api/users/login/",
            {"email": self.a.email, "password": PASS},
            HTTP_X_CSRFTOKEN=token,
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(client.post("/api/users/confirm-password/").status_code, 403)
        token = client.get("/api/users/csrf/").data["csrfToken"]
        self.assertEqual(
            client.post(
                "/api/users/confirm-password/",
                HTTP_X_CSRFTOKEN=token,
                HTTP_ORIGIN="https://evil.example",
            ).status_code,
            403,
        )
        self.assertEqual(
            client.post(
                "/api/users/confirm-password/",
                {"password": PASS},
                HTTP_X_CSRFTOKEN=token,
            ).status_code,
            200,
        )

    def test_cookie_security_and_cors(self):
        with override_settings(
            SESSION_COOKIE_SECURE=True,
            CSRF_COOKIE_SECURE=True,
            SESSION_COOKIE_SAMESITE="None",
        ):
            r = self.login()
            cookie = r.cookies[settings.SESSION_COOKIE_NAME]
            self.assertTrue(cookie["secure"])
            self.assertTrue(cookie["httponly"])
            self.assertEqual(cookie["samesite"], "None")
        r = self.client.get("/api/users/me/", HTTP_ORIGIN="https://evil.example")
        self.assertNotIn("Access-Control-Allow-Origin", r)
        r = self.client.get("/api/users/me/", HTTP_ORIGIN="http://localhost:3000")
        self.assertEqual(r["Access-Control-Allow-Origin"], "http://localhost:3000")
        self.assertEqual(r["Access-Control-Allow-Credentials"], "true")

    def test_password_confirmation_short_lived_and_does_not_unlock_vault(self):
        with patch("users.views.time", return_value=1000):
            response = self.client.post(
                "/api/users/confirm-password/",
                {"password": PASS, "email": self.b.email},
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            self.client.session["face_enrollment_password_confirmed_until"], 1300
        )
        self.assertNotIn(PASS, str(self.client.session.items()))
        self.assertNotIn(PASS, str(response.data))
        self.assertEqual(self.client.get("/api/users/passwords/").status_code, 403)
        with patch("users.views.time", return_value=1300):
            self.assertEqual(
                self.client.post("/api/users/image-upload/").status_code, 403
            )
        self.assertEqual(BiometricTemplate.objects.count(), 0)

    def test_wrong_confirmation_revokes_marker_and_cannot_select_other_user(self):
        self.b.set_password("Other-account-password!42")
        self.b.save()
        self.assertEqual(
            self.client.post(
                "/api/users/confirm-password/", {"password": PASS}
            ).status_code,
            200,
        )
        result = self.client.post(
            "/api/users/confirm-password/",
            {
                "password": "Other-account-password!42",
                "email": self.b.email,
                "username": self.b.username,
            },
        )
        self.assertEqual(result.status_code, 400)
        self.assertEqual(result.data, {"detail": "Password confirmation failed."})
        self.assertNotIn(
            "face_enrollment_password_confirmed_until", self.client.session
        )
        self.assertEqual(self.client.post("/api/users/image-upload/").status_code, 403)

    def test_confirmation_is_bound_to_current_session(self):
        self.assertEqual(
            self.client.post(
                "/api/users/confirm-password/", {"password": PASS}
            ).status_code,
            200,
        )
        other = APIClient()
        self.login(other)
        self.assertEqual(other.post("/api/users/image-upload/").status_code, 403)

    def test_confirmation_throttled_per_user_and_source(self):
        for _ in range(5):
            self.assertEqual(
                self.client.post(
                    "/api/users/confirm-password/", {"password": "wrong"}
                ).status_code,
                400,
            )
        response = self.client.post("/api/users/confirm-password/", {"password": PASS})
        self.assertEqual(response.status_code, 429)
        self.assertLessEqual(int(response["Retry-After"]), 300)
        # Changing the IP does not bypass the account limit.
        self.assertEqual(
            self.client.post(
                "/api/users/confirm-password/",
                {"password": PASS},
                REMOTE_ADDR="192.0.2.1",
            ).status_code,
            429,
        )
        other = APIClient()
        self.login(other, self.b.email)
        self.assertEqual(
            other.post("/api/users/confirm-password/", {"password": PASS}).status_code,
            429,
        )

    def test_logged_in_or_password_confirmed_session_cannot_replace_face(self):
        self.assertEqual(
            self.client.post(
                "/api/users/confirm-password/", {"password": PASS}
            ).status_code,
            200,
        )
        template = BiometricTemplate.objects.create(
            user=self.a, encoding=json.dumps([0.1] * 128)
        )
        before = BiometricTemplate.objects.get(pk=template.pk).encoding
        self.assertEqual(self.client.post("/api/users/image-upload/").status_code, 403)
        self.assertEqual(
            self.client.post(
                "/api/users/confirm-password/", {"password": PASS}
            ).status_code,
            403,
        )
        self.assertEqual(BiometricTemplate.objects.get(pk=template.pk).encoding, before)
        self.assertEqual(self.client.get("/api/users/passwords/").status_code, 403)

    def test_face_replacement_requires_current_face_and_invalidates_all_old_grants(
        self,
    ):
        self.unlock()
        self.new_password()
        other = APIClient()
        self.login(other)
        self.unlock(other)
        with patch("users.biometrics.extract_encoding", return_value=[0.5] * 128):
            result = self.client.post(
                "/api/users/image-upload/",
                {"image": SimpleUploadedFile("new.png", b"fixture")},
            )
        self.assertEqual(result.status_code, 201)
        self.assertEqual(
            json.loads(
                decrypt(
                    BiometricTemplate.objects.get(user=self.a).encoding,
                    "BIOMETRIC_ENCRYPTION_KEY",
                )
            ),
            [0.5] * 128,
        )
        self.assertEqual(self.client.get("/api/users/passwords/").status_code, 403)
        self.assertEqual(other.get("/api/users/passwords/").status_code, 403)
        self.assertEqual(other.post("/api/users/image-upload/").status_code, 403)
        self.assertNotIn("vault_factor", self.client.session)
        self.assertNotIn("vault_until", self.client.session)
        with patch("users.biometrics.extract_encoding", return_value=[0.1] * 128):
            self.assertEqual(
                self.client.post(
                    "/api/users/verify-face/",
                    {"image": SimpleUploadedFile("old.png", b"fixture")},
                ).status_code,
                400,
            )
        with patch("users.biometrics.extract_encoding", return_value=[0.5] * 128):
            self.assertEqual(
                self.client.post(
                    "/api/users/verify-face/",
                    {"image": SimpleUploadedFile("new.png", b"fixture")},
                ).status_code,
                200,
            )
        self.assertEqual(len(self.client.get("/api/users/passwords/").data), 1)

    def test_face_grant_is_five_minutes_and_old_non_face_grants_fail_closed(self):
        with patch("users.views.time", return_value=time()) as clock:
            self.unlock()
            self.assertEqual(
                self.client.session["vault_until"], clock.return_value + 300
            )
        self.assertEqual(self.client.session["vault_factor"], "face")
        session = self.client.session
        session["vault_factor"] = "retired-factor"
        session.save()
        self.assertEqual(self.client.get("/api/users/passwords/").status_code, 403)
        self.assertEqual(self.client.post("/api/users/image-upload/").status_code, 403)

    def test_lock_and_logout_clear_temporary_enrollment_authorization(self):
        for endpoint in ["lock", "logout"]:
            with self.subTest(endpoint=endpoint):
                self.login()
                self.assertEqual(
                    self.client.post(
                        "/api/users/confirm-password/", {"password": PASS}
                    ).status_code,
                    200,
                )
                old_key = self.client.session.session_key
                self.assertEqual(
                    self.client.post(f"/api/users/{endpoint}/").status_code, 200
                )
                for key in [
                    "face_enrollment_password_confirmed_until",
                    "vault_until",
                    "vault_factor",
                    "vault_face_version",
                ]:
                    self.assertNotIn(key, self.client.session)
                if endpoint == "logout":
                    from django.contrib.sessions.models import Session

                    self.assertFalse(
                        Session.objects.filter(session_key=old_key).exists()
                    )

    def test_invalid_enrollment_image_does_not_create_template(self):
        self.assertEqual(
            self.client.post(
                "/api/users/confirm-password/", {"password": PASS}
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client.post(
                "/api/users/image-upload/",
                {"image": SimpleUploadedFile("bad.png", b"invalid")},
            ).status_code,
            400,
        )
        self.assertFalse(BiometricTemplate.objects.filter(user=self.a).exists())
        self.assertEqual(self.client.get("/api/users/passwords/").status_code, 403)

    def test_confirmation_accepts_exact_existing_password_without_strength_rules(self):
        self.a.set_password(" x ")
        self.a.save()
        self.assertEqual(
            self.client.post(
                "/api/users/login/", {"email": self.a.email, "password": " x "}
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client.post(
                "/api/users/confirm-password/", {"password": " x "}
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client.post(
                "/api/users/confirm-password/", {"password": "x"}
            ).status_code,
            400,
        )
        self.assertNotIn(
            "face_enrollment_password_confirmed_until", self.client.session
        )

    def test_no_face_user_cannot_unlock_with_login_or_password_confirmation(self):
        self.new_password()
        self.assertEqual(
            self.client.post(
                "/api/users/confirm-password/", {"password": PASS}
            ).status_code,
            200,
        )
        self.assertEqual(self.client.get("/api/users/passwords/").status_code, 403)
        result = self.client.post("/api/users/verify-face/")
        self.assertEqual(result.status_code, 404)
        self.assertEqual(
            result.data,
            {"detail": "Set up face verification before unlocking your vault."},
        )
        self.assertNotIn("vault_until", self.client.session)
        self.assertEqual(self.client.get("/api/users/passwords/").status_code, 403)
