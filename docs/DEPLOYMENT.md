# Manual deployment guide

No provider resource, domain, subscription or payment has been created. Stop at any
billing or paid-tier step and complete it manually only if you choose to proceed.
Validate with synthetic data before inviting public users.

## Render backend and database

1. Review available resources in your own account. Use an existing PostgreSQL
   database or manually create an eligible no-cost one only after checking the
   current plan details. If payment is required, this is **MANUAL USER ACTION**.
2. Keep PostgreSQL private. Use its internal connection URL from the same Render
   region. Restrict/disable external database access in the provider dashboard.
   Never create a public DNS record or custom domain for the database.
3. Create/import a web service from
   `Divygas040/Secure_Password_Manager_Biometric`, branch `production-hardening`.
   Root directory: `password-manager-backend`. Runtime: Docker. Dockerfile:
   `Dockerfile`. The prepared blueprint lists a free web plan and uses an existing
   DATABASE_URL; it does not create a database. Review it before applying.
4. Set all required variables listed in ENVIRONMENT.md in Render's private editor.
   Use DEBUG=False. Set ALLOWED_HOSTS to the service's actual onrender.com hostname
   and later its API domain. Set both origin lists to your exact frontend origin.
   Enable TRUST_PROXY_HTTPS only behind Render's HTTPS terminator. Verify the real
   proxy count before changing source-IP throttle settings.
5. The image builds dlib with compiler/CMake in a separate stage, installs locked
   runtime packages, and runs as a non-root user. Production credentials are not
   required at image build time. No `.env`, databases or media are copied.
6. Startup runs migrations, checks existing encrypted data/legacy-photo readiness,
   collects static assets and starts Gunicorn bound to PORT. It uses one worker and
   two threads to limit biometric memory use. Multiple replicas require a separate
   single migration/release job; do not run overlapping upgrades.
7. Configure health path `/health/`. It returns only basic status; it is a liveness
   check, not a database readiness probe. Confirm database access through signup,
   login and a complete vault test. Review build/startup logs without logging inputs.
8. The current Linux Docker image and hosted resource sizing still require the
   manual validation workflow/Render build. Native dlib compilation passed locally
   on Python 3.12; that alone does not prove a Render image build or memory fit.

## Vercel frontend

1. Import the same repository and branch. Root directory:
   `password-manager-frontend`. Framework: Next.js. Node: 24 (or supported 22.18+).
2. Install: `npm ci`; build: `npm run build`; default Next.js output directory.
3. Set NEXT_PUBLIC_API_URL to the backend's HTTPS origin (no path or trailing API
   prefix), then rebuild. This variable is public and is compiled into the client;
   never put credentials into it. Do not put backend keys in Vercel public variables.
4. A normal vercel.app preview is sufficient. Configure the exact preview origin on
   Render in both CORS_ALLOWED_ORIGINS and CSRF_TRUSTED_ORIGINS; do not use wildcards.
5. Test signup, login, logout, current-password confirmation, face enrollment/replacement, vault operations, camera permissions,
   and reload/session expiry from the browser. Production camera access needs HTTPS.

## Cookies: development, preview and custom domains

| Deployment | Cookie policy | Origin configuration |
| --- | --- | --- |
| Local HTTP, same host spelling | DEBUG=True, Lax, non-Secure | Exact local frontend origin |
| vercel.app → onrender.com | DEBUG=False, None, Secure | Exact HTTPS preview origin in both lists |
| example.com → api.example.com | DEBUG=False, Lax, Secure | Exact HTTPS frontend origin in both lists |

Cross-site preview cookies may be blocked by browser third-party-cookie policy even
with SameSite=None. Test the actual target browsers. Do not disable CSRF, loosen CORS
or downgrade Secure cookies. Prefer the same-site custom domains once owned, or a
separately reviewed same-origin proxy design if previews must work in such browsers.
Native sessions renew on authenticated activity; users log in again after expiry.

## Future domain and DNS — MANUAL USER ACTION

The following names are placeholders, not an existing/purchased domain:

```text
example.com       -> Vercel frontend
www.example.com   -> Vercel alias/redirect to the preferred hostname
api.example.com   -> Render backend
PostgreSQL        -> private DATABASE_URL only; no public custom domain
```

1. Purchase a domain only if you choose to; no agent purchase is authorized.
2. Add the frontend apex/www domains in Vercel and API subdomain in Render.
3. At the registrar, apply the exact current records shown by those dashboards.
   Do not copy guessed provider IPs from old tutorials. Do not add database DNS.
4. Wait for verification/TLS certificates. Test HTTPS on all intended hostnames.
5. Update NEXT_PUBLIC_API_URL, ALLOWED_HOSTS, both origin lists and COOKIE_SAMESITE.
   Rebuild the frontend. Verify redirects and cookies in the intended browsers.
6. Start SECURE_HSTS_SECONDS at zero; raise it gradually after HTTPS works. Subdomain
   coverage and preload are deliberately disabled. Their deploy-check warnings are
   not a reason to preload a domain you do not own/control.

## Manual pre-deployment validation

The repository includes a **workflow_dispatch-only** GitHub Actions workflow with
PostgreSQL 17, Linux Docker build, backend tests, frontend tests/build/lint and audit.
It is not automatically started by a push. Run it in the Actions UI only after
reviewing available runner usage and permissions. No workflow has been run on your
account by this change. A successful hosted run is required to close the local
PostgreSQL/Docker validation gaps before public deployment.

Next.js stays on the maintained 15.x line with security updates; the PostCSS override
is a same-major patch resolving transitive advisories without forcing Next 16.
See [Next.js's August security release](https://nextjs.org/blog/august-2026-security-release).
The Django API follows the framework's
[CSRF guidance](https://docs.djangoproject.com/en/5.2/howto/csrf/).

## Biometric authorization release checks

Confirm first enrollment requires a freshly confirmed current password. Confirm
replacement requires the current face and locks all old template grants. Existing
vault grants must be re-established by face verification after this release. There
is no alternate delivery-based recovery flow. The existing custom domains remain
www.biopassmanager.online (frontend) and api.biopassmanager.online (API); PostgreSQL
continues to use a private connection URL and has no public domain.

Previously configured message-delivery variables may be removed manually only
after the new release starts successfully. This branch does not change the real
Render environment. Keep the database URL, Django secret and both encryption keys.
