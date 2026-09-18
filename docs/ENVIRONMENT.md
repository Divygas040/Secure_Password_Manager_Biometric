# Environment configuration

The backend loads `password-manager-backend/password_manager/.env` with
`django-environ`. Process environment overrides the file. All `.env` variants
are ignored; `.env.example` is the only tracked environment template.

| Variable | Purpose |
| --- | --- |
| DJANGO_SECRET_KEY | Required private Django signing secret; production rejects weak/missing values |
| VAULT_ENCRYPTION_KEY | Required valid Fernet key for credentials |
| BIOMETRIC_ENCRYPTION_KEY | Required, different Fernet key for face templates and legacy photo envelopes |
| DEBUG | Boolean, defaults false; true only for explicit local development |
| ALLOWED_HOSTS | Comma-separated API hostnames, no wildcard |
| CORS_ALLOWED_ORIGINS | Comma-separated exact frontend origins |
| CSRF_TRUSTED_ORIGINS | Comma-separated exact trusted frontend origins |
| DATABASE_URL | Private PostgreSQL URL, mandatory when DEBUG is false |
| COOKIE_SAMESITE | Lax for local/same-site domains; None only for HTTPS cross-site previews |
| TRUST_PROXY_HTTPS | Trust X-Forwarded-Proto only behind a trusted terminating proxy |
| TRUSTED_PROXY_COUNT | Number of trusted proxies for source-IP throttling; defaults zero |
| SECURE_HSTS_SECONDS | Start at zero; increase after HTTPS validation |
| NEXT_PUBLIC_API_URL | Frontend API origin; public configuration, never a secret |

`ALLOWED_HOSTS`, both origin lists, database URL and keys fail closed when required
production settings are absent. Whitespace and empty comma-list entries are removed.
Production origins require HTTPS. Production requires PostgreSQL. No production
hostname or secret fallback is embedded in Python.

Key formats: Django's secret must be long and random; production enforces at least
50 characters and rejects the development prefix. Both encryption keys must be
URL-safe base64 encodings of 32 random bytes accepted by Fernet. Keep the two keys
separate and stable. Missing/wrong encryption keys make existing data unreadable;
do not generate replacement keys as a startup workaround.

Sessions use a host-only cookie belonging to the API. The frontend cannot read it.
The CSRF cookie is also HttpOnly; a masked token is returned by the CSRF endpoint.
No authentication cookie is shared with the frontend hostname. There are no JWT
access/refresh tokens and no refresh secrets to configure.

Only configure forwarded-header trust on infrastructure that overwrites that
header and prevents direct access to the app port. Verify the actual proxy chain
before changing TRUSTED_PROXY_COUNT. A value that is too large may trust spoofed
addresses; zero may cause users behind a proxy to share a rate-limit bucket.

Account email remains a login identifier. No delivery configuration is required.
