"""Migration rehearsal in a disposable database, never the caller's data."""

import os
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
        }
        base = {
            key: value
            for key, value in base.items()
            if not key.startswith(("EMAIL_", "RESEND_", "ANYMAIL"))
            and key != "DEFAULT_FROM_EMAIL"
        }
        configured = subprocess.run(
            [sys.executable, "-c", "import password_manager.settings"],
            cwd=settings.BASE_DIR,
            env=base,
            capture_output=True,
        )
        self.assertEqual(
            configured.returncode,
            0,
            "Production configuration failed without delivery variables; output withheld.",
        )
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

    def test_column_removal_preserves_account_vault_template_sessions_and_limits(self):
        with tempfile.TemporaryDirectory() as directory:
            env = {
                **os.environ,
                "DEBUG": "True",
                "DATABASE_URL": f"sqlite:///{directory}/migration.sqlite3",
                "DJANGO_SECRET_KEY": settings.SECRET_KEY,
                "VAULT_ENCRYPTION_KEY": settings.VAULT_ENCRYPTION_KEY,
                "BIOMETRIC_ENCRYPTION_KEY": settings.BIOMETRIC_ENCRYPTION_KEY,
            }
            script = """
import json
from datetime import timedelta
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.utils import timezone
executor = MigrationExecutor(connection)
old_targets = [('users', '0011_vault_sessions_otp_biometrics'), ('sessions', '0001_initial')]
executor.migrate(old_targets)
apps = executor.loader.project_state(old_targets).apps
User = apps.get_model('users', 'CustomUser')
P = apps.get_model('users', 'Password')
B = apps.get_model('users', 'BiometricTemplate')
R = apps.get_model('users', 'RateLimitBucket')
S = apps.get_model('sessions', 'Session')
u = User.objects.create(username='preserved', email='preserved@example.invalid', phone='12345678901', password='fixture-hash')
P.objects.create(user=u, domain_name='preserved', password='preserved vault credential', link='https://example.com')
B.objects.create(user=u, encoding=json.dumps([0.25] * 128))
R.objects.create(key='preserved-bucket', started_at=timezone.now(), count=2)
S.objects.create(session_key='preserved-session', session_data='fixture-data', expire_date=timezone.now() + timedelta(days=1))
tables = ['users_customuser', 'users_password', 'users_biometrictemplate', 'users_ratelimitbucket', 'django_session']
def snapshot():
    result = {}
    with connection.cursor() as cursor:
        for table in tables:
            cursor.execute('SELECT * FROM ' + table)
            names = [column[0] for column in cursor.description]
            result[table] = [dict(zip(names, row)) for row in cursor.fetchall()]
    return result
before = snapshot()
executor = MigrationExecutor(connection)
executor.migrate([('users', '0012_remove_otp_fields'), ('sessions', '0001_initial')])
after = snapshot()
old_fields = set(before['users_customuser'][0]) - set(after['users_customuser'][0])
assert old_fields == {'otp_secret', 'otp_generated', 'otp_digest', 'otp_expires_at', 'otp_sent_at', 'otp_attempts', 'otp_session'}
for row in before['users_customuser']:
    for field in old_fields:
        del row[field]
assert after == before, 'Records or ciphertext changed unexpectedly'
from users.models import Password, BiometricTemplate
from users.fields import decrypt
assert decrypt(Password.objects.get().password) == 'preserved vault credential'
assert json.loads(decrypt(BiometricTemplate.objects.get().encoding, 'BIOMETRIC_ENCRYPTION_KEY')) == [0.25] * 128
"""
            result = subprocess.run(
                [
                    sys.executable,
                    str(settings.BASE_DIR / "manage.py"),
                    "shell",
                    "-c",
                    script,
                ],
                env=env,
                capture_output=True,
            )
            self.assertEqual(
                result.returncode,
                0,
                "Disposable migration preservation rehearsal failed; output withheld.",
            )


from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from unittest.mock import patch
from django.db import close_old_connections, connections
from django.test import TransactionTestCase, skipUnlessDBFeature
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from users.models import CustomUser, BiometricTemplate


class PostgreSQLConcurrencyTests(TransactionTestCase):
    @skipUnlessDBFeature("has_select_for_update")
    def test_concurrent_initial_enrollments_cannot_replace_the_first_template(self):
        self.addCleanup(connections.close_all)
        CustomUser.objects.create_user(
            "concurrent",
            email="concurrent@example.invalid",
            phone="15555550100",
            password="Concurrency-fixture!42",
        )
        cookies = []
        for _ in range(2):
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
            self.assertEqual(
                client.post(
                    "/api/users/confirm-password/",
                    {"password": "Concurrency-fixture!42"},
                ).status_code,
                200,
            )
            cookies.append(client.cookies[settings.SESSION_COOKIE_NAME].value)
        barrier = Barrier(2, timeout=10)

        def attempt(cookie):
            close_old_connections()
            try:
                client = APIClient()
                client.cookies[settings.SESSION_COOKIE_NAME] = cookie
                barrier.wait()
                return client.post(
                    "/api/users/image-upload/",
                    {"image": SimpleUploadedFile("face.png", b"fixture")},
                ).status_code
            finally:
                connections.close_all()

        with patch("users.biometrics.extract_encoding", return_value=[0.1] * 128):
            with ThreadPoolExecutor(max_workers=2) as pool:
                self.assertEqual(sorted(pool.map(attempt, cookies)), [201, 403])
        self.assertEqual(BiometricTemplate.objects.count(), 1)
