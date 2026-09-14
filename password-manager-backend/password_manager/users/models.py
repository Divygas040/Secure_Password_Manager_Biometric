from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.functions import Lower
from .fields import EncryptedTextField

class CustomUser(AbstractUser):
    phone = models.CharField(max_length=15, unique=True)
    # Legacy fields retained until an explicit, verified retirement command.
    face_image = models.OneToOneField('Image', on_delete=models.SET_NULL, blank=True, null=True, related_name='user_face_image')
    otp_secret = models.CharField(max_length=255, blank=True, null=True)
    otp_generated = models.CharField(max_length=255, blank=True, null=True)
    otp_digest = models.CharField(max_length=64, blank=True)
    otp_expires_at = models.DateTimeField(null=True, blank=True)
    otp_sent_at = models.DateTimeField(null=True, blank=True)
    otp_attempts = models.PositiveSmallIntegerField(default=0)
    otp_session = models.CharField(max_length=64, blank=True)

    class Meta(AbstractUser.Meta):
        constraints = [models.UniqueConstraint(Lower('email'), name='unique_user_email_ci')]

class Image(models.Model):
    """Legacy photos: inaccessible via API; explicit conversion command provided."""
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='image')
    image_data = models.BinaryField(null=True, blank=True)
    filename = models.CharField(max_length=255, blank=True, null=True)
    content_type = models.CharField(max_length=100, default='image/png')
    uploaded_at = models.DateTimeField(auto_now_add=True)

class BiometricTemplate(models.Model):
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='biometric_template')
    encoding = EncryptedTextField(key_name='BIOMETRIC_ENCRYPTION_KEY')
    updated_at = models.DateTimeField(auto_now=True)

class Password(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='passwords')
    domain_name = models.CharField(max_length=255)
    password = EncryptedTextField()
    link = models.URLField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'users'

class RateLimitBucket(models.Model):
    key = models.CharField(max_length=64, unique=True)
    started_at = models.DateTimeField()
    count = models.PositiveIntegerField(default=0)
