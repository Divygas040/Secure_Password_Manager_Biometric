# Validation for the current authorization flow

The release replaces the retired delivery-based authorization flow with fresh
current-password confirmation for first face enrollment and current-face verification
for replacement. It keeps encrypted storage, server sessions, CSRF, CORS and throttling.

Tests use disposable databases and synthetic captures; successful face comparison
is mocked in authorization tests. A real installed detector is also exercised on
a non-face image. No live production requests or deployments are part of validation.

PostgreSQL row-lock concurrency cannot run on SQLite. The dedicated concurrency
test verifies that simultaneous first-enrollment requests cannot overwrite the first
accepted template. Its workers explicitly close their thread-local DB connections.
Run the manually triggered PostgreSQL workflow before release to exercise it.

Remaining manual checks: real camera enrollment and matching, hosted sessions,
HTTPS, migration on a backed-up production database, and runtime resource sizing.
Face matching has no liveness protection, no alternate recovery flow and no claim
of production-grade identity assurance. Server operators holding keys can decrypt
data. Use only synthetic vault credentials for this educational demo.

## Results for this release

- Django `check`: passed, zero issues.
- `makemigrations --check`: no drift; generated migration 0012 reviewed as seven
  RemoveField operations only. Historical migrations were not edited.
- `migrate`: passed on a disposable local SQLite database.
- Backend: 51 discovered, 50 passed and one PostgreSQL-only concurrency test skipped;
  database teardown completed. Includes preservation of stored records/ciphertext,
  password-confirmation authorization, replacement restrictions, template-version
  revocation across sessions, expiry/lock/logout, validation, encryption and CSRF.
- PostgreSQL initialization was attempted locally; the sandbox denied shared-memory
  allocation (`shmget`). The row-lock test has not been claimed as passed.
- `pip check`: passed after removing the delivery library and its exclusive HTTP
  dependencies from the workspace runtime. No retained runtime dependency requires them.
- Frontend: clean `npm ci` passed; 17 tests passed; lint and production build passed.
  The install audit reported zero vulnerabilities. Tests cover initial/replacement
  sequence, exact password handling, clearing on success/failure, duplicate guards,
  no-face guidance and safe API errors.
- Browser smoke on the compiled local app: login, no-face vault guidance, first
  enrollment password form, generic incorrect-password error, successful transition
  to the camera step and logout passed using a disposable account. No face was captured.
- Benign existing warnings remain for deprecated pkg_resources in the face-model
  package and Node's TypeScript module-type detection. No application test failed.
- No production behavior, real face matching, Docker build or deployment was verified
  by this release. No hosted secrets, resources or billing settings were changed.
