# Generated migration to convert Image model from file storage to database storage

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0009_customuser_otp_generated'),
    ]

    operations = [
        # Add new fields first (nullable)
        migrations.AddField(
            model_name='image',
            name='image_data',
            field=models.BinaryField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='image',
            name='filename',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name='image',
            name='content_type',
            field=models.CharField(default='image/png', max_length=100),
        ),
        # Remove old fields
        migrations.RemoveField(
            model_name='image',
            name='image',
        ),
        migrations.RemoveField(
            model_name='image',
            name='image_url',
        ),
    ]

