from django.core.management.base import BaseCommand, CommandError
from users.models import Image, Password, BiometricTemplate
from users.fields import decrypt

class Command(BaseCommand):
    help = 'Fail closed if legacy photos remain or ciphertext cannot be decrypted.'
    def handle(self, *args, **options):
        if Image.objects.exists():
            raise CommandError('Legacy photos remain. Run the documented offline conversion before serving traffic.')
        try:
            for row in Password.objects.all().iterator():
                decrypt(row.password)
            for row in BiometricTemplate.objects.all().iterator():
                decrypt(row.encoding, 'BIOMETRIC_ENCRYPTION_KEY')
        except Exception:
            raise CommandError('Encrypted data validation failed. Restore the correct keys; no data changed.') from None
        self.stdout.write('Data readiness checks passed.')
