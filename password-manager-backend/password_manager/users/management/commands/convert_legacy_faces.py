"""Explicit, transactional conversion; preserves legacy data on any failure."""

import json
from cryptography.fernet import Fernet
from django.conf import settings
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from users.biometrics import extract_encoding
from users.fields import decrypt
from users.models import Image, BiometricTemplate


class Command(BaseCommand):
    help = "Convert encrypted legacy photos to encrypted templates, then discard converted photos. Back up offline first."

    @transaction.atomic
    def handle(self, *args, **options):
        seen = set()
        count = 0
        for photo in Image.objects.select_for_update().all():
            if (
                photo.user_id in seen
                or BiometricTemplate.objects.filter(user_id=photo.user_id).exists()
            ):
                raise CommandError(
                    "Ambiguous legacy enrollment; resolve offline. Transaction rolled back."
                )
            seen.add(photo.user_id)
            data = bytes(photo.image_data or b"")
            try:
                prefix = b"legacy-fernet:v1:"
                if not data.startswith(prefix):
                    raise ValueError
                raw = Fernet(settings.BIOMETRIC_ENCRYPTION_KEY.encode()).decrypt(
                    data[len(prefix) :]
                )
                encoding = extract_encoding(SimpleUploadedFile("legacy.png", raw))
                template = BiometricTemplate.objects.create(
                    user_id=photo.user_id, encoding=json.dumps(encoding)
                )
                template.refresh_from_db()
                if (
                    json.loads(decrypt(template.encoding, "BIOMETRIC_ENCRYPTION_KEY"))
                    != encoding
                ):
                    raise ValueError
            except Exception:
                raise CommandError(
                    "A legacy photo could not be converted. Transaction rolled back; restore or re-enroll offline."
                ) from None
            photo.delete()
            count += 1
        self.stdout.write(
            f"Converted {count} legacy enrollments. No image content retained for those records."
        )
