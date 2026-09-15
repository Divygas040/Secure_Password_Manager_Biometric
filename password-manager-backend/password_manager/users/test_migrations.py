"""Migration rehearsal in a disposable database, never the caller's data."""

import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from django.conf import settings


class LegacyMigrationTests(unittest.TestCase):
    def test_plaintext_and_legacy_photos_are_preserved_as_ciphertext(self):
        with tempfile.TemporaryDirectory() as directory:
            env = {
                **os.environ,
                "DEBUG": "True",
                "DATABASE_URL": f"sqlite:///{directory}/migration.sqlite3",
                "DJANGO_SECRET_KEY": settings.SECRET_KEY,
                "VAULT_ENCRYPTION_KEY": settings.VAULT_ENCRYPTION_KEY,
                "BIOMETRIC_ENCRYPTION_KEY": settings.BIOMETRIC_ENCRYPTION_KEY,
            }

            def run(*args):
                result = subprocess.run(
                    [sys.executable, str(settings.BASE_DIR / "manage.py"), *args],
                    env=env,
                    capture_output=True,
                    text=True,
                )
                self.assertEqual(
                    result.returncode,
                    0,
                    "Migration rehearsal command failed; captured output withheld to protect data.",
                )

            run("migrate", "users", "0010", "--noinput")
            run(
                "shell",
                "-c",
                """
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
apps=MigrationExecutor(connection).loader.project_state([('users','0010_convert_image_to_binary')]).apps
User=apps.get_model('users','CustomUser'); P=apps.get_model('users','Password'); I=apps.get_model('users','Image')
u=User.objects.create(username='legacy',email='legacy@example.invalid',phone='12345678901')
P.objects.create(user=u,domain_name='legacy',password='fernet:v1:literal-legacy-value',link='https://example.com')
I.objects.create(user=u,image_data=b'legacy-photo-fixture')
""",
            )
            run("migrate", "--noinput")
            run(
                "shell",
                "-c",
                """
from users.models import Password, Image
from users.fields import decrypt
from cryptography.fernet import Fernet
from django.conf import settings
p=Password.objects.get()
assert p.password != 'fernet:v1:literal-legacy-value'
assert decrypt(p.password) == 'fernet:v1:literal-legacy-value'
i=Image.objects.get(); raw=bytes(i.image_data)
assert raw != b'legacy-photo-fixture'
assert Fernet(settings.BIOMETRIC_ENCRYPTION_KEY.encode()).decrypt(raw[len(b'legacy-fernet:v1:'):]) == b'legacy-photo-fixture'
""",
            )

    def test_mandatory_production_configuration_fails_closed(self):
        base = {
            **os.environ,
            "DEBUG": "False",
            "DJANGO_SECRET_KEY": settings.SECRET_KEY,
            "VAULT_ENCRYPTION_KEY": settings.VAULT_ENCRYPTION_KEY,
            "BIOMETRIC_ENCRYPTION_KEY": settings.BIOMETRIC_ENCRYPTION_KEY,
            "ALLOWED_HOSTS": "api.example.com",
            "CORS_ALLOWED_ORIGINS": "https://example.com",
            "CSRF_TRUSTED_ORIGINS": "https://example.com",
            "DATABASE_URL": "postgres://fixture:fixture@localhost/fixture",
            "EMAIL_BACKEND": "django.core.mail.backends.smtp.EmailBackend",
            "EMAIL_HOST_USER": "fixture@example.invalid",
            "EMAIL_HOST_PASSWORD": "test-only-placeholder",
        }
        for field, value in [
            ("DJANGO_SECRET_KEY", ""),
            ("VAULT_ENCRYPTION_KEY", ""),
            ("BIOMETRIC_ENCRYPTION_KEY", ""),
            ("DATABASE_URL", ""),
            ("ALLOWED_HOSTS", "*"),
            ("CORS_ALLOWED_ORIGINS", "*"),
            ("CSRF_TRUSTED_ORIGINS", "http://example.com"),
        ]:
            with self.subTest(field=field):
                result = subprocess.run(
                    [sys.executable, "-c", "import password_manager.settings"],
                    cwd=settings.BASE_DIR,
                    env={**base, field: value},
                    capture_output=True,
                )
                self.assertNotEqual(result.returncode, 0)


from concurrent.futures import ThreadPoolExecutor
import re
from django.core import mail
from django.db import close_old_connections, connections
from django.test import TransactionTestCase, override_settings, skipUnlessDBFeature
from rest_framework.test import APIClient
from users.models import CustomUser


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class PostgreSQLConcurrencyTests(TransactionTestCase):
    @skipUnlessDBFeature("has_select_for_update")
    def test_otp_can_only_be_consumed_once_under_concurrency(self):
        self.addCleanup(connections.close_all)
        CustomUser.objects.create_user(
            "concurrent",
            email="concurrent@example.invalid",
            phone="15555550100",
            password="Concurrency-fixture!42",
        )
        client = APIClient()
        self.assertEqual(
            client.post(
                "/api/users/login/",
                {
                    "email": "concurrent@example.invalid",
                    "password": "Concurrency-fixture!42",
                },
            ).status_code,
            200,
        )
        self.assertEqual(client.post("/api/users/send-otp-email/").status_code, 200)
        code = re.search(r"\b\d{6}\b", mail.outbox[-1].body).group()
        cookie = client.cookies[settings.SESSION_COOKIE_NAME].value

        def attempt(_):
            close_old_connections()
            try:
                c = APIClient()
                c.cookies[settings.SESSION_COOKIE_NAME] = cookie
                return c.post("/api/users/verify-otp/", {"otp": code}).status_code
            finally:
                # Healthy persistent connections must also close in their owning thread.
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(sorted(pool.map(attempt, range(2))), [200, 400])
