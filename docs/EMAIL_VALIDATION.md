# Resend delivery and input validation

This change starts from production main at `b41316b` and is prepared on
`email-validation-hardening`. It does not modify deployed secrets or deploy resources.

## Email configuration

The default production backend is `anymail.backends.resend.EmailBackend` from
pinned `django-anymail==15.2`. It uses Resend's HTTPS API through the existing
Django `send_mail()` call, with a 15-second request timeout. No webhook, inbound
mail or extra Resend permissions are needed.

The production sender is `BioPass <security@biopassmanager.online>`; it is the
Resend sender default and is also recorded in the Render blueprint. The user has
confirmed that this domain is already verified and a Sending-access key exists.
No new domain registration, verification or key creation is required by this change.
Keep its existing verification records in DNS.

Configure these variables in Render's private environment editor:

- `EMAIL_BACKEND`: select the Anymail Resend backend above. An existing SMTP value
  must be changed explicitly; environment values override the application default.
- `RESEND_API_KEY`: use the existing Sending-access key privately. The application
  reads only this environment variable; there is no key in source, tests, examples
  or Docker configuration. Missing/empty credentials fail startup when Resend is selected.
- `DEFAULT_FROM_EMAIL`: use the verified BioPass sender above.

Do not send the key to a chat or put it in logs. Existing SMTP settings may remain
unused; no Gmail credentials or other production secrets are changed by this branch.
SMTP remains an explicit alternative for environments that support it.

For local development only, set `DEBUG` to true and choose
`django.core.mail.backends.console.EmailBackend` through `EMAIL_BACKEND`. Console
mail prints the message (including the ephemeral code) to the local terminal; use
synthetic data and keep those logs private. Production still rejects console,
file, dummy and in-memory backends. Automated tests use mocked HTTPS or in-memory
mail, with no provider credentials and no real outbound messages.

The OTP security design is unchanged: random six digits, digest storage, session
binding, five-minute expiry, cooldown, attempt cap and one-time use. Provider
exceptions are caught without logging their contents; failure invalidates the
challenge and returns a generic 503 response. API acceptance is not proof of inbox
delivery: test a real account's OTP after deployment and inspect delivery status
privately if necessary. Never copy the OTP or provider payload into public logs.

## Field audit and enforced rules

| Form/input | Validation |
| --- | --- |
| Signup username (renamed from Full Name) | Trim outer whitespace; 3–30 ASCII letters/digits or `@ . + - _`; Django ASCIIUsernameValidator and uniqueness |
| Signup phone | 10–15 ASCII digits; no spaces/punctuation; uniqueness |
| Signup/login email | Trim/lowercase; email syntax; maximum 254 characters |
| Signup account password | Exact string; 12–128 characters plus Django strength validators |
| Login password | Required, maximum 128; no new strength requirement on existing credentials |
| Signup acknowledgement | Required in the interface; no authentication capability is granted by it |
| Email code | Exactly six ASCII digits; client removes non-digits; verification disabled until complete |
| Vault service/display name | Trim; 1–255 characters; reject invisible/control-only names without restricting ordinary service names |
| Vault password | Required, maximum 4096; preserve whitespace and weak existing passwords; never apply account strength rules |
| Vault URL | Optional; trim; valid HTTP(S), maximum 200 (existing model limit) |
| Camera capture | JPEG/PNG, up to 2 MB; explain one clear face and four-million-pixel server limit |
| Password generator options | Existing cryptographic generator; signup slider 12–32, within account limit; vault slider retains existing bounds |

Django/DRF remains authoritative; browser validation provides immediate field
feedback before a request. As before, DRF rejects null characters and invalid
surrogate code points in strings. Passwords are not trimmed or silently rewritten.
These are API validation changes, not a model/schema redesign; existing usernames
are not renamed and no migration is required.

All editable forms have input labels, appropriate limits/autocomplete/input modes,
linked helper/error descriptions, invalid-state attributes and request guards.
Password visibility controls are keyboard-accessible buttons. The original visual
layout is retained. Camera verification still has no liveness/anti-spoofing claim.

## Errors and retry behavior

The shared API formatter separates DRF field errors from form-level failures.
Forms display field errors inline; network/authentication/general failures use
safe messages. HTML/debug/provider error bodies are not displayed. Login credential
failures and registration uniqueness failures remain generic.

HTTP 429 responses preserve retry information. The database throttle reports the
remaining blocked window, considering all blocked identity buckets. OTP resend
responses include the remaining seconds and Retry-After header. CORS exposes only
the additional non-secret Retry-After header; the origin allowlist, credential and
CSRF policies are unchanged. OTP resend/verify buttons respect the wait countdown.

## Manual release checks

1. Review and merge the branch through your normal process; main is not changed by this work.
2. Configure the three email variables privately on Render and deploy the merged code.
3. Rebuild/deploy the frontend so the form validation changes are included.
4. Confirm a real OTP arrives from the verified sender, unlocks once, and is rejected
   on replay. Confirm resend timing and login/signup/vault field feedback.
5. Keep the existing DNS verification records; monitor provider delivery failures
   without exposing credentials or message bodies. No payment/upgrade is required
   by the code change; provider quotas still apply.

Local regression tests cover HTTPS transport success/failure using mocks, OTP
security, new field boundaries, error formatting and retry timing. Hosted delivery
and PostgreSQL concurrency require the deployed environment/CI; local SQLite cannot
exercise the PostgreSQL-only concurrency test. No live email delivery is claimed.

## Results for this branch

- Django `check`: passed, zero issues.
- Backend suite: 46 discovered; 45 passed, one PostgreSQL-only concurrency test
  skipped on the local SQLite database. Test database teardown completed.
- `makemigrations --check`: no changes detected; no new migration is needed.
- `pip check`: no broken requirements.
- Frontend: 11 tests passed; lint passed; production build passed.
- Clean `npm ci`: passed using a writable workspace cache; audit reported zero vulnerabilities.
- Local compiled-app browser smoke: signup username/help text and invalid-field
  feedback verified; login required-field messages verified. No accounts or live
  emails were created by the browser check.
- Initial verification exposed incorrect boundary-test fixtures (email length,
  password-commonness assumption and missing login session timestamp); corrected
  the fixtures without relaxing application checks. The frontend build first hit
  a stale duplicate type package; a clean install resolved it. The default npm
  cache was unwritable, so installation used a workspace cache.
- A development-server smoke attempt hit the local file-watcher limit; the compiled
  production server was used successfully instead. Docker/Render deployment and
  real Resend inbox delivery were not run.
