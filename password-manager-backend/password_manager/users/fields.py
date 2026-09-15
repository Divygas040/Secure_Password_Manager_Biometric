"""Versioned authenticated ciphertext. Decryption is always explicit."""

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.db import models

PREFIX = "fernet:v1:"


class Ciphertext(str):
    """Only database reads mark values as already encrypted."""


def decrypt(value, key_name="VAULT_ENCRYPTION_KEY"):
    if not isinstance(value, Ciphertext) or not value.startswith(PREFIX):
        raise InvalidToken
    return (
        Fernet(getattr(settings, key_name).encode())
        .decrypt(value[len(PREFIX) :].encode())
        .decode()
    )


class EncryptedTextField(models.TextField):
    def __init__(self, *args, key_name="VAULT_ENCRYPTION_KEY", **kwargs):
        self.key_name = key_name
        super().__init__(*args, **kwargs)

    def deconstruct(self):
        name, path, args, kwargs = super().deconstruct()
        if self.key_name != "VAULT_ENCRYPTION_KEY":
            kwargs["key_name"] = self.key_name
        return name, path, args, kwargs

    def from_db_value(self, value, expression, connection):
        return Ciphertext(value) if value is not None else None

    def get_prep_value(self, value):
        if value is None:
            return None
        if isinstance(value, Ciphertext):
            # Validate integrity and key before writing an existing value back.
            decrypt(value, self.key_name)
            return str(value)
        token = Fernet(getattr(settings, self.key_name).encode()).encrypt(
            str(value).encode()
        )
        return PREFIX + token.decode()
