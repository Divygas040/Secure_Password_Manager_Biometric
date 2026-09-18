from datetime import timedelta
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.utils import timezone
from users.models import RateLimitBucket


class Command(BaseCommand):
    help = "Remove expired sessions and stale throttle buckets."

    def handle(self, *args, **options):
        call_command("clearsessions")
        RateLimitBucket.objects.filter(
            started_at__lt=timezone.now() - timedelta(days=1)
        ).delete()
        self.stdout.write("Expired security state removed.")
