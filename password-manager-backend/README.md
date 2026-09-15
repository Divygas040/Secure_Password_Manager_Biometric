# Backend

Django lives in `password_manager/`, beside `manage.py`. Python 3.12.14 is the
deployment target. Install development requirements from that directory;
`requirements.production.lock` is the resolved runtime dependency set.

The project root [README](../README.md) contains local setup and the security model.
See [configuration](../docs/ENVIRONMENT.md), [data migration](../docs/DATA_MIGRATION.md),
and [deployment](../docs/DEPLOYMENT.md) before starting an existing database.

`.env` belongs in `password_manager/.env`, is ignored by Git, and is loaded using
django-environ. All mandatory secrets must be set even for local development;
none are generated or embedded by the app. Only the safe `.env.example` is tracked.

Use Docker on Render for the native biometric build dependencies. The native
build.sh remains available for environments that already provide a compiler/CMake.
