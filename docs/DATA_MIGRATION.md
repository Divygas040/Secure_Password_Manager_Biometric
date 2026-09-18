# Existing data and keys

Back up the database and encryption keys securely offline before upgrading. Stop
old app instances first; they must not write plaintext while migration is running.
Never upload database backups, face photos or keys to GitHub.

`users/0011_vault_sessions_otp_biometrics.py` adds historical security state, encrypted face
templates and shared throttle counters. It widens the password column to encrypted
text and encrypts **every** pre-0011 credential, including strings that happen to
look like ciphertext. It normalizes email case and refuses blank/duplicate emails
instead of merging or discarding accounts. Expired legacy challenge secrets are
invalidated. The migration is atomic and intentionally has no plaintext rollback.
A failed migration must be diagnosed and rerun, not faked as applied.

Legacy `Image.image_data` photos are wrapped in authenticated encryption with the
biometric key during migration. They are not exposed by any API. Before serving
traffic, the startup readiness command refuses to proceed while any legacy Image
records remain. Convert them explicitly after backing up:

```sh
python manage.py migrate --noinput
python manage.py convert_legacy_faces
python manage.py check_data_ready
```

The converter derives an encoding, encrypts it, reads and verifies it, then removes
the converted legacy photo record. The whole conversion rolls back on a malformed
image, duplicate enrollment, missing image data or any extraction failure. It does
not choose between ambiguous photos or replace a newer enrollment. Resolve those
cases offline with the account owner and re-enroll where necessary. No photos are
automatically discarded just to pass deployment checks.

Older migration 0010 removed filesystem image references without converting files.
Deployments predating that migration need an offline inventory and backup of their
old media files before upgrading. Those files cannot be safely inferred from the
new database. Do not expose the legacy media directory on the web. No destructive
cleanup of historical files is automated.

Historical plaintext can remain in old backups, SQLite free pages/journals or
PostgreSQL WAL/backups. This change encrypts active rows; it does not sanitize
historical storage. Retire those artifacts through the database provider's secure
retention process after validating a recoverable encrypted backup.

## Key operations

The field marks ciphertext only when read from the database and validates it before
writing it unchanged. Ordinary model saves, queryset updates and bulk inserts
prepare plaintext through encryption. API inputs cannot label themselves as already
encrypted. Application reads decrypt only after ownership and vault authorization
checks. Direct SQL, database superusers and compromised app processes remain trusted
operator boundaries; they can bypass application code.

Do not rotate keys by merely changing environment variables: old records will no
longer decrypt. Planned rotation requires an offline maintenance job with old/new
keys, authenticated decrypt/re-encrypt, complete verification and a recoverable
backup before switching services. Automated key rotation is not implemented.

Run `python manage.py cleanup_security_state` daily using an existing approved
scheduler to clear expired sessions/challenges and old rate-limit buckets. No paid
scheduled resource is created here. Never log session rows or challenge contents.

## Current field-removal migration

Migration 0012 removes only seven retired account challenge fields. Historical
migrations, including 0011, remain unchanged. The new migration does not recreate
users or touch saved credential ciphertext, biometric templates, sessions or rate
limit records. A disposable migration rehearsal compares those records and their
ciphertext before and after the upgrade and verifies decryption. Back up first.

An application rollback requires restoring a compatible schema and release; dropped
challenge values cannot be recovered by reversing the schema operation. They are
not part of the new authorization flow. Stored encryption keys must remain stable.
