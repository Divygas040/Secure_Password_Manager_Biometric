from time import time
from rest_framework.permissions import BasePermission


class VaultUnlocked(BasePermission):
    message = "Verify an email code or your enrolled face to unlock the vault."

    def has_permission(self, request, view):
        return bool(
            request.user.is_authenticated
            and request.session.get("vault_until", 0) > time()
        )


class OTPVerified(VaultUnlocked):
    message = "Verify an email code before enrolling or replacing face verification."

    def has_permission(self, request, view):
        return (
            super().has_permission(request, view)
            and request.session.get("vault_factor") == "otp"
        )
