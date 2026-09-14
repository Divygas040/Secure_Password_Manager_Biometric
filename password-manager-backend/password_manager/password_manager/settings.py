"""Environment-driven local and Render settings. Secrets never have defaults."""
from pathlib import Path
from urllib.parse import urlsplit

import environ
from cryptography.fernet import Fernet
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
env = environ.Env()
environ.Env.read_env(BASE_DIR / '.env', overwrite=False)
DEBUG = env.bool('DEBUG', default=False)
SECRET_KEY = env('DJANGO_SECRET_KEY')
if not SECRET_KEY or (not DEBUG and (len(SECRET_KEY) < 50 or len(set(SECRET_KEY)) < 5 or SECRET_KEY.startswith('django-insecure-'))):
    raise ImproperlyConfigured('DJANGO_SECRET_KEY must be a strong, private secret.')

VAULT_ENCRYPTION_KEY = env('VAULT_ENCRYPTION_KEY')
BIOMETRIC_ENCRYPTION_KEY = env('BIOMETRIC_ENCRYPTION_KEY')
for name in ('VAULT_ENCRYPTION_KEY', 'BIOMETRIC_ENCRYPTION_KEY'):
    try:
        Fernet(globals()[name].encode('ascii'))
    except (ValueError, UnicodeError):
        raise ImproperlyConfigured(f'{name} must be a valid Fernet key.') from None
if VAULT_ENCRYPTION_KEY == BIOMETRIC_ENCRYPTION_KEY:
    raise ImproperlyConfigured('Vault and biometric encryption keys must differ.')

def csv(name, default=''):
    return [part.strip() for part in env(name, default=default).split(',') if part.strip()]

ALLOWED_HOSTS = csv('ALLOWED_HOSTS', 'localhost,127.0.0.1' if DEBUG else '')
CORS_ALLOWED_ORIGINS = csv('CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000' if DEBUG else '')
CSRF_TRUSTED_ORIGINS = csv('CSRF_TRUSTED_ORIGINS', ','.join(CORS_ALLOWED_ORIGINS) if DEBUG else '')
if '*' in ALLOWED_HOSTS or (not DEBUG and not ALLOWED_HOSTS):
    raise ImproperlyConfigured('ALLOWED_HOSTS must list explicit hosts.')
for origin in CORS_ALLOWED_ORIGINS + CSRF_TRUSTED_ORIGINS:
    parsed = urlsplit(origin)
    if '*' in origin or not parsed.hostname or parsed.path or parsed.query or parsed.fragment or parsed.username or parsed.scheme not in (('http', 'https') if DEBUG else ('https',)):
        raise ImproperlyConfigured('CORS/CSRF origins must be explicit origins (HTTPS in production), without paths.')
if not DEBUG and (not CORS_ALLOWED_ORIGINS or not CSRF_TRUSTED_ORIGINS):
    raise ImproperlyConfigured('Production requires CORS_ALLOWED_ORIGINS and CSRF_TRUSTED_ORIGINS.')
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = False
CORS_URLS_REGEX = r'^/api/.*$'

INSTALLED_APPS = [
    'django.contrib.admin', 'django.contrib.auth', 'django.contrib.contenttypes',
    'django.contrib.sessions', 'django.contrib.messages', 'django.contrib.staticfiles',
    'corsheaders', 'rest_framework', 'users',
]
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'users.middleware.PrivateResponsesMiddleware',
]
ROOT_URLCONF = 'password_manager.urls'
WSGI_APPLICATION = 'password_manager.wsgi.application'
TEMPLATES = [{'BACKEND': 'django.template.backends.django.DjangoTemplates', 'DIRS': [], 'APP_DIRS': True,
              'OPTIONS': {'context_processors': [
                  'django.template.context_processors.request', 'django.contrib.auth.context_processors.auth',
                  'django.contrib.messages.context_processors.messages']}}]
if env('DATABASE_URL', default=''):
    DATABASES = {'default': env.db('DATABASE_URL', conn_max_age=60)}
elif DEBUG:
    DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': BASE_DIR / 'db.sqlite3'}}
else:
    raise ImproperlyConfigured('DATABASE_URL is required in production.')
if not DEBUG and DATABASES['default']['ENGINE'] != 'django.db.backends.postgresql':
    raise ImproperlyConfigured('Production requires PostgreSQL.')
DATABASES['default']['CONN_HEALTH_CHECKS'] = True
AUTH_USER_MODEL = 'users.CustomUser'
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 12}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]
PASSWORD_HASHERS = ['django.contrib.auth.hashers.Argon2PasswordHasher', 'django.contrib.auth.hashers.PBKDF2PasswordHasher']
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['users.authentication.CookieSessionAuthentication'],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
    'DEFAULT_RENDERER_CLASSES': ['rest_framework.renderers.JSONRenderer'],
    'DEFAULT_THROTTLE_CLASSES': ['users.throttles.DatabaseThrottle'],
    'DEFAULT_PARSER_CLASSES': ['rest_framework.parsers.JSONParser', 'rest_framework.parsers.MultiPartParser'],
    'NUM_PROXIES': env.int('TRUSTED_PROXY_COUNT', default=0),
    'EXCEPTION_HANDLER': 'users.exceptions.api_exception_handler',
}
# DB-backed sessions: revocable; renewed on activity, expire after 30 minutes idle.
SESSION_ENGINE = 'django.contrib.sessions.backends.db'
SESSION_COOKIE_NAME = 'biopass_session'
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_AGE = 1800
SESSION_SAVE_EVERY_REQUEST = True
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = env('COOKIE_SAMESITE', default='Lax')
CSRF_COOKIE_SAMESITE = SESSION_COOKIE_SAMESITE
if SESSION_COOKIE_SAMESITE not in ('Lax', 'Strict', 'None') or (DEBUG and SESSION_COOKIE_SAMESITE == 'None'):
    raise ImproperlyConfigured('COOKIE_SAMESITE must be Lax/Strict, or None with production HTTPS.')
# Host-only cookies; never share authentication cookies with frontend subdomains.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https') if env.bool('TRUST_PROXY_HTTPS', default=False) else None
SECURE_SSL_REDIRECT = not DEBUG
SECURE_HSTS_SECONDS = env.int('SECURE_HSTS_SECONDS', default=0)
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'no-referrer'
X_FRAME_OPTIONS = 'DENY'
CSRF_FAILURE_VIEW = 'users.views.csrf_failure'
DATA_UPLOAD_MAX_MEMORY_SIZE = 3 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 3 * 1024 * 1024
FILE_UPLOAD_HANDLERS = ['django.core.files.uploadhandler.MemoryFileUploadHandler']
MAX_FACE_IMAGE_BYTES = 2 * 1024 * 1024
MAX_FACE_IMAGE_PIXELS = 4_000_000
VAULT_UNLOCK_SECONDS = 300
OTP_TTL_SECONDS = 300
OTP_RESEND_SECONDS = 60
OTP_MAX_ATTEMPTS = 5
EMAIL_BACKEND = env('EMAIL_BACKEND', default='django.core.mail.backends.smtp.EmailBackend')
if not DEBUG and EMAIL_BACKEND in ('django.core.mail.backends.console.EmailBackend', 'django.core.mail.backends.filebased.EmailBackend', 'django.core.mail.backends.dummy.EmailBackend', 'django.core.mail.backends.locmem.EmailBackend'):
    raise ImproperlyConfigured('Production requires a real delivery email backend.')
EMAIL_HOST = env('EMAIL_HOST', default='smtp.gmail.com')
EMAIL_PORT = env.int('EMAIL_PORT', default=587)
EMAIL_USE_TLS = env.bool('EMAIL_USE_TLS', default=True)
EMAIL_USE_SSL = env.bool('EMAIL_USE_SSL', default=False)
EMAIL_HOST_USER = env('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = env('DEFAULT_FROM_EMAIL', default=EMAIL_HOST_USER)
EMAIL_TIMEOUT = 15
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True
STATIC_URL = '/assets/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STORAGES = {'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
            'staticfiles': {'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage'}}
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
