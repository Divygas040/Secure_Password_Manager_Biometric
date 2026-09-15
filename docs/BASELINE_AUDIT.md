# Baseline audit

Audited clean commit 95e6818 from Divygas040/Secure_Password_Manager_Biometric.
Remote verified; work continues on production-hardening without rewriting main.
The prior local Phase 3A changes are carried forward.

Architecture: Next.js App Router pages call Django/DRF directly; SimpleJWT
access/refresh tokens live in localStorage. SQLite defaults and PostgreSQL URL
support exist. Render configuration uses Python 3.9, wildcard hosts and native
builds of unbounded biometric dependencies. Three requirements lists diverge.

Critical findings:
- Password.password stores plaintext; misleading hash/encryption comments.
- Signup prints credentials; frontend prints signup data and JWT response.
- OTP is persisted plaintext, accepted repeatedly without expiry or attempt
  limit, placed in GET query parameters and printed to logs.
- Standalone auth/face/OTP components simulate success with client state.
- Face checks do not create a backend vault authorization grant.
- Raw face photos remain in Image.image_data; endpoints leak exception detail.
- No login/OTP/face throttles, email uniqueness is only application checked.
- localStorage is accessed while rendering client components during SSR.
- Multiple face-api model loaders, external model source, missing stream cleanup.
- Password generator uses Math.random; public claims exaggerate protections.
- Unused database router, duplicate JWT refresh routes, commented dead endpoints,
  duplicate backend package lock and unused demo auth components.
- Migration 0010 removes legacy file references without converting files.
  Existing deployments predating it require offline backup/recovery review.

Baseline checks in a clean worktree using the previous isolated environment:
- manage.py check: PASS.
- manage.py check --deploy: six warnings (HSTS, HTTPS redirect, test secret
  length, session/CSRF secure cookies, DEBUG). Test key was disposable.
- makemigrations --check --dry-run: PASS, no drift.
- manage.py test: zero tests found.
- Earlier raw requirements installation selected OpenCV 5, which broke the
  CascadeClassifier import. pyotp was missing; legacy face-recognition requires
  pkg_resources. Previous checks needed OpenCV 4, pyotp and setuptools<81.

Frontend baseline build/lint/audit results are recorded in VALIDATION.md after
completion. Baseline tooling also initially used a resolved Python symlink
instead of its virtualenv entry point; that harness error was corrected before
recording backend results above.
