# Input validation and safe API errors

## Field audit and enforced rules

| Form/input | Validation |
| --- | --- |
| Signup username (renamed from Full Name) | Trim outer whitespace; 3–30 ASCII letters/digits or `@ . + - _`; Django ASCIIUsernameValidator and uniqueness |
| Signup phone | 10–15 ASCII digits; no spaces/punctuation; uniqueness |
| Signup/login email | Trim/lowercase; email syntax; maximum 254 characters |
| Signup account password | Exact string; 12–128 characters plus Django strength validators |
| Login password | Required, maximum 128; no new strength requirement on existing credentials |
| Signup acknowledgement | Required in the interface; no authentication capability is granted by it |
| Vault service/display name | Trim; 1–255 characters; reject invisible/control-only names without restricting ordinary service names |
| Vault password | Required, maximum 4096; preserve whitespace and weak existing passwords; never apply account strength rules |
| Vault URL | Optional; trim; valid HTTP(S), maximum 200 (existing model limit) |
| Current password confirmation | Required, exact string, maximum 128; no signup-strength rule; cleared after each request |
| Camera capture | JPEG/PNG, up to 2 MB; explain one clear face and four-million-pixel server limit |
| Password generator options | Existing cryptographic generator; signup slider 12–32, within account limit; vault slider retains existing bounds |

Django/DRF remains authoritative; browser validation provides immediate field
feedback before a request. As before, DRF rejects null characters and invalid
surrogate code points in strings. Passwords are not trimmed or silently rewritten.
These are API validation changes, not a model/schema redesign; existing usernames
are not renamed. The release separately applies migration 0012 to remove retired
security-state columns; it does not alter these input limits.

All editable forms have input labels, appropriate limits/autocomplete/input modes,
linked helper/error descriptions, invalid-state attributes and request guards.
Password visibility controls are keyboard-accessible buttons. The original visual
layout is retained. Camera verification still has no liveness/anti-spoofing claim.


## Authorization flow

Account login uses email and password. First face enrollment requires a fresh,
five-minute current-password confirmation; it is consumed by enrollment. Existing
templates require current-face verification for replacement. Enrollment never
unlocks the vault. Face verification grants five-minute access; replacement, lock
and logout invalidate the applicable authorizations.

The confirmation form clears its password state after each request, including
errors, and blocks duplicate submissions. A password-only session cannot read
credentials or replace an existing template. The server rechecks every rule.

## Error handling

The shared API formatter displays field errors next to inputs and safe form-level
errors in notifications. It does not render server HTML, debug pages or internal
error details. Throttle responses preserve Retry-After and remaining wait information.
CORS exposes that non-secret header without changing the origin allowlist.

Email remains the login identifier only. No account email confirmation is performed.
Existing signup, login, vault-field and camera-image validation remains in place.
