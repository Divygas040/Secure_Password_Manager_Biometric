"""Shared PostgreSQL counters, including account and source limits."""
from django.db import transaction
from django.utils import timezone
from django.utils.crypto import salted_hmac
from rest_framework.throttling import BaseThrottle
from rest_framework.settings import api_settings
from .models import RateLimitBucket

RATES = {'api': (120, 60), 'login': (10, 300), 'signup': (5, 3600),
         'otp_send': (5, 3600), 'otp_verify': (15, 300), 'face': (10, 300)}

class DatabaseThrottle(BaseThrottle):
    def allow_request(self, request, view):
        scope = getattr(view, 'throttle_scope', 'api')
        limit, seconds = RATES[scope]
        now = timezone.now()
        identities = ['ip:' + self.get_ident(request)]
        if request.user.is_authenticated:
            identities.append('user:' + str(request.user.pk))
        elif scope == 'login':
            email = request.data.get('email', '')
            if isinstance(email, str):
                identities.append('email:' + email.strip().lower()[:254])
        allowed = True
        self.remaining = seconds
        for identity in identities:
            key = salted_hmac('rate-limit', scope + ':' + identity).hexdigest()
            with transaction.atomic():
                bucket, _ = RateLimitBucket.objects.get_or_create(key=key, defaults={'started_at': now})
                bucket = RateLimitBucket.objects.select_for_update().get(pk=bucket.pk)
                elapsed = (now - bucket.started_at).total_seconds()
                if elapsed >= seconds:
                    bucket.started_at, bucket.count = now, 0
                if bucket.count >= limit:
                    allowed = False
                else:
                    bucket.count += 1
                    bucket.save(update_fields=['started_at', 'count'])
        return allowed

    def wait(self):
        return self.remaining
