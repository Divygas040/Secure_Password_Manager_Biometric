# Validation record

Validated locally on macOS ARM64, Python 3.12.14, Django 5.2.17. Test secrets and
databases were disposable and excluded from Git. No deployment was performed.

| Check | Result |
| --- | --- |
| Django `check` | Passed; zero issues |
| Django `check --deploy`, production configuration | Exit 0; two intentional warnings: security.W005 and security.W021 (HSTS subdomains/preload disabled) |
| `makemigrations --check` | Passed; no drift |
| Django tests | 31 discovered: 30 passed, one PostgreSQL concurrency test skipped on SQLite |
| Disposable database migration rehearsal | Passed; legacy credentials and photo bytes preserved as ciphertext |
| `migrate`, `check_data_ready`, `collectstatic` | Passed on local disposable database |
| `pip check` | Passed; no broken requirements |
| Native biometric dependency installation | Passed, including dlib compilation and real detector rejection of a blank image |
| `npm ci` | Passed |
| Frontend unit tests | Two passed, zero failed |
| Frontend lint | Passed |
| Next.js production build | Passed; eight routes prerendered |
| `npm audit` | Passed; zero vulnerabilities |
| Local browser smoke | Login and dashboard/vault verification screen exercised |
| Git diff whitespace / tracked secret-artifact review | Passed |

## Baseline and resolved failures

The original backend had no tests and six deployment warnings. The baseline frontend
lockfile did not support a clean npm install; lint could not start after the install
failure. Its audit reported 62 advisories (one critical, 26 high, 28 moderate, seven
low). Dependencies and the lockfile were corrected without a Next.js/React major
upgrade. An incompatible unbounded OpenCV install and missing OTP dependency were
encountered in the original stack; obsolete implementations were replaced with the
existing face-recognition detector and cryptographic OTP generation. An invalid
DATABASE_URL parser argument found during verification was corrected. Generated
Next.js output was excluded from lint. A network-failed audit was rerun successfully.

## Validation gaps and remaining risks

- PostgreSQL could not initialize locally because the sandbox denied shared-memory
  allocation. The row-lock concurrency test is explicitly skipped on SQLite.
- Docker is unavailable locally. The Linux image build, PostgreSQL integration and
  hosted resource sizing remain unverified. Run the manual validation workflow before
  public deployment; it includes PostgreSQL and a Docker build.
- Live SMTP delivery, real face enrollment/matching, hosted cookies, HTTPS and DNS
  remain manual end-to-end checks. Unit tests mock successful face matches; a real
  installed detector was tested only on a non-face image.
- Camera face matching has no liveness/anti-spoofing protection. Use only synthetic
  vault data for this demo; server operators can decrypt data with the keys.
- The face-recognition models dependency emits a pkg_resources deprecation warning;
  setuptools is pinned below the removal version. Node emits a harmless module-type
  autodetection warning during the small test suite.
- HSTS subdomain/preload warnings are intentional until domain ownership and HTTPS
  coverage are confirmed. This is not an independent security audit or certification.

The GitHub workflow runs only when manually dispatched. No billing, deployment,
provider-resource creation, domain purchase or workflow execution was performed.
