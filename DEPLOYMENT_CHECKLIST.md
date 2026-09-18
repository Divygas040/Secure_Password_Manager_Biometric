# Deployment checklist

Code preparation does not mean hosted deployment has been tested. Complete these
items with synthetic data before opening the demo publicly. Never record secret
values or credentials in this file.

- [ ] Secrets created privately and backed up securely
- [ ] Production DJANGO_SECRET_KEY configured
- [ ] VAULT_ENCRYPTION_KEY configured and backed up
- [ ] Separate BIOMETRIC_ENCRYPTION_KEY configured and backed up
- [ ] Private PostgreSQL DATABASE_URL configured; external access restricted
- [ ] NEXT_PUBLIC_API_URL configured and frontend rebuilt
- [ ] CORS_ALLOWED_ORIGINS configured exactly
- [ ] CSRF_TRUSTED_ORIGINS configured exactly
- [ ] ALLOWED_HOSTS configured without wildcards
- [ ] Cookie SameSite and proxy settings verified for the actual deployment
- [ ] PostgreSQL integration/concurrency tests passed in the manual workflow
- [ ] Linux Docker build passed; service memory use measured with face verification
- [ ] Existing data backed up and legacy migration/conversion reviewed
- [ ] Backend deployed
- [ ] Migrations succeeded; check_data_ready passes
- [ ] /health/ works without leaking service details
- [ ] Frontend deployed
- [ ] Signup works
- [ ] Login, idle/absolute expiry and logout work
- [ ] Face enrollment and real face verification work (including a rejected mismatch)
- [ ] Password encryption verified in the production database without logging values
- [ ] Cross-user authorization and CSRF tested on hosted origins
- [ ] Legacy plaintext backups/media retention resolved securely
- [ ] Cleanup of expired security state scheduled through an approved mechanism
- [ ] Custom domain purchased — **MANUAL USER ACTION; payment decision**
- [ ] Any required hosting/database/mail paid plan — **MANUAL USER ACTION; payment decision**
- [ ] Frontend apex/www DNS configured — **MANUAL USER ACTION**
- [ ] API subdomain DNS configured — **MANUAL USER ACTION**
- [ ] PostgreSQL has NO public custom domain
- [ ] HTTPS verified on all intended domains
- [ ] HSTS policy reviewed after HTTPS validation
- [ ] Final security test completed; known demo risks accepted
- [ ] production-hardening reviewed before any merge to main

- [ ] Fresh current password is required for first face enrollment
- [ ] Initial enrollment authorization expires and is consumed once
- [ ] Current face is required for replacement
- [ ] Replacement invalidates old vault grants and requires new-face verification
- [ ] Five-minute vault expiry, explicit lock and logout are verified
- [ ] No-face users see setup guidance and cannot access credentials
- [ ] Review lack of liveness detection and lack of alternate account recovery
