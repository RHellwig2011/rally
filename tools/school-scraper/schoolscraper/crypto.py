from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken


class Vault:
    """Symmetric encryption for per-user credentials.

    The master key is derived from a passphrase (env: SCHOOLSCRAPER_MASTER_KEY)
    so the same passphrase produces the same Fernet key across restarts.
    """

    def __init__(self, master_key: str):
        if not master_key:
            raise RuntimeError(
                "SCHOOLSCRAPER_MASTER_KEY is required to encrypt user credentials. "
                "Generate one with: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
            )
        digest = hashlib.sha256(master_key.encode()).digest()
        self._fernet = Fernet(base64.urlsafe_b64encode(digest))

    def encrypt(self, plaintext: str) -> str:
        if not plaintext:
            return ""
        return self._fernet.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        if not ciphertext:
            return ""
        try:
            return self._fernet.decrypt(ciphertext.encode()).decode()
        except InvalidToken as e:
            raise RuntimeError(
                "Failed to decrypt credential. The master key has changed or "
                "the data is corrupt."
            ) from e
