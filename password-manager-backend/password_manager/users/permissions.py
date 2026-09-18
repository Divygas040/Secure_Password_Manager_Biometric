from time import time
from rest_framework.permissions import BasePermission
from .models import BiometricTemplate


class VaultUnlocked(BasePermission):
    message = "Verify your face to unlock the vault."

    def has_permission(self, request, view):
        if not (
            request.user.is_authenticated
            and request.session.get("vault_until", 0) > time()
            and request.session.get("vault_factor") == "face"
        ):
            return False
        version = (
            BiometricTemplate.objects.filter(user=request.user)
            .values_list("updated_at", flat=True)
            .first()
        )
        # Replacement invalidates grants tied to the old template in every session.
        return bool(
            version and request.session.get("vault_face_version") == version.isoformat()
        )
