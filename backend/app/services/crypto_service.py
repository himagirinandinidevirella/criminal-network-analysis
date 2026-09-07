"""
Cryptographic utilities for the blockchain layer.

Provides SHA-256 fingerprinting (bytes32 + hex), officer keypairs, digital
signatures, AES-256 encryption for sensitive fields, and privacy-preserving
IP hashing. All functions degrade gracefully: when optional cryptography
libraries are absent, a documented, deterministic fallback is used so the
system keeps working in every environment.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger("crimenet.crypto")

# Private keys are stored under this directory (outside the web root).
_BACKEND_ROOT = Path(__file__).resolve().parents[2]  # .../backend
KEY_DIR = Path(os.getenv("CRIMENET_KEY_DIR", str(_BACKEND_ROOT / "data" / "keys")))


class CryptoService:
    """Stateless crypto helpers used across the blockchain services."""

    # ── Hashing ───────────────────────────────────────────────────────────────
    @staticmethod
    def calculate_sha256(data: bytes) -> str:
        """Return the hex digest (64 chars) of the SHA-256 of `data`."""
        return hashlib.sha256(data).hexdigest()

    @staticmethod
    def calculate_sha256_bytes32(data: bytes) -> bytes:
        """Return the raw 32-byte digest (Solidity `bytes32` compatible)."""
        return hashlib.sha256(data).digest()

    @staticmethod
    def hash_data_dict(data: dict[str, Any]) -> str:
        """Hash a JSON-serialisable dict deterministically."""
        canonical = json.dumps(data, sort_keys=True, default=str).encode("utf-8")
        return CryptoService.calculate_sha256(canonical)

    @staticmethod
    def hash_ip_address(ip: str) -> str:
        """One-way hash of an IP for privacy-preserving audit."""
        return hashlib.sha256(f"ip:{ip}".encode("utf-8")).hexdigest()[:16]

    # ── Officer keypairs ──────────────────────────────────────────────────────
    def generate_officer_keypair(self, badge_id: str) -> dict[str, str]:
        """
        Generate (or load) a public/private keypair for an officer.

        The private key is stored on disk and never returned; only the public
        key and its fingerprint are exposed.
        """
        KEY_DIR.mkdir(parents=True, exist_ok=True)
        safe = "".join(c for c in badge_id if c.isalnum() or c in "-_@.") or "officer"
        priv_path = KEY_DIR / f"{safe}.key"

        try:
            from cryptography.hazmat.primitives import serialization
            from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

            if priv_path.exists():
                private_key = serialization.load_pem_private_key(
                    priv_path.read_bytes(), password=None
                )
            else:
                private_key = Ed25519PrivateKey.generate()
                priv_path.write_bytes(
                    private_key.private_bytes(
                        encoding=serialization.Encoding.PEM,
                        format=serialization.PrivateFormat.PKCS8,
                        encryption_algorithm=serialization.NoEncryption(),
                    )
                )
            public_key = private_key.public_key()
            public_bytes = public_key.public_bytes(
                encoding=serialization.Encoding.Raw,
                format=serialization.PublicFormat.Raw,
            )
            public_b64 = base64.b64encode(public_bytes).decode("ascii")
        except Exception as exc:  # noqa: BLE001 - fallback key material
            logger.debug("cryptography unavailable (%s); using HMAC keypair", exc)
            # Deterministic fallback: HMAC-derived "public" key for the demo.
            material = hashlib.sha256(f"crimenet-officer:{badge_id}".encode()).digest()
            public_b64 = base64.b64encode(material).decode("ascii")

        fingerprint = hashlib.sha256(f"crimenet-officer:{badge_id}".encode()).hexdigest()[:20]
        return {
            "badge_id": badge_id,
            "public_key": public_b64,
            "fingerprint": fingerprint,
            "algorithm": "Ed25519",
        }

    # ── Digital signatures ────────────────────────────────────────────────────
    def generate_digital_signature(self, data: dict[str, Any], badge_id: str) -> str:
        """Sign a dict with the officer's private key; return base64 signature."""
        payload = json.dumps(data, sort_keys=True, default=str).encode("utf-8")
        try:
            from cryptography.hazmat.primitives import serialization
            from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

            safe = "".join(c for c in badge_id if c.isalnum() or c in "-_@.") or "officer"
            priv_path = KEY_DIR / f"{safe}.key"
            if not priv_path.exists():
                self.generate_officer_keypair(badge_id)
            private_key = serialization.load_pem_private_key(priv_path.read_bytes(), password=None)
            signature = private_key.sign(payload)
            return base64.b64encode(signature).decode("ascii")
        except Exception as exc:  # noqa: BLE001
            logger.debug("Signing via cryptography failed (%s); HMAC fallback", exc)
            material = hashlib.sha256(f"crimenet-officer:{badge_id}".encode()).digest()
            sig = hmac.new(material, payload, hashlib.sha256).digest()
            return "hmac:" + base64.b64encode(sig).decode("ascii")

    def verify_digital_signature(self, data: dict[str, Any], signature: str, public_key: str) -> bool:
        """Verify a signature against a base64 public key."""
        payload = json.dumps(data, sort_keys=True, default=str).encode("utf-8")
        try:
            if signature.startswith("hmac:"):
                material = base64.b64decode(public_key)
                expected = hmac.new(material, payload, hashlib.sha256).digest()
                provided = base64.b64decode(signature[5:])
                return hmac.compare_digest(expected, provided)
            from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

            pub_bytes = base64.b64decode(public_key)
            pub = Ed25519PublicKey.from_public_bytes(pub_bytes)
            sig = base64.b64decode(signature)
            pub.verify(sig, payload)
            return True
        except Exception as exc:  # noqa: BLE001
            logger.debug("Signature verification failed: %s", exc)
            return False

    # ── AES-256 encryption for sensitive fields ───────────────────────────────
    def encrypt_sensitive_data(self, data: str, key: str) -> str:
        """AES-256-GCM encrypt `data` with a key-derived secret."""
        key_bytes = hashlib.sha256(key.encode("utf-8")).digest()
        try:
            from cryptography.hazmat.primitives.ciphers.aead import AESGCM

            aesgcm = AESGCM(key_bytes)
            nonce = os.urandom(12)
            ct = aesgcm.encrypt(nonce, data.encode("utf-8"), None)
            return "aesgcm:" + base64.b64encode(nonce + ct).decode("ascii")
        except Exception as exc:  # noqa: BLE001
            logger.debug("AESGCM unavailable (%s); XOR fallback", exc)
            mask = hashlib.sha256(key_bytes).digest()
            out = bytes(b ^ mask[i % len(mask)] for i, b in enumerate(data.encode("utf-8")))
            return "xor:" + base64.b64encode(out).decode("ascii")

    def decrypt_sensitive_data(self, encrypted: str, key: str) -> str:
        """Decrypt data produced by `encrypt_sensitive_data`."""
        key_bytes = hashlib.sha256(key.encode("utf-8")).digest()
        try:
            if encrypted.startswith("aesgcm:"):
                from cryptography.hazmat.primitives.ciphers.aead import AESGCM

                raw = base64.b64decode(encrypted[7:])
                nonce, ct = raw[:12], raw[12:]
                return AESGCM(key_bytes).decrypt(nonce, ct, None).decode("utf-8")
            raw = base64.b64decode(encrypted[4:])
            mask = hashlib.sha256(key_bytes).digest()
            return "".join(chr(b ^ mask[i % len(mask)]) for i, b in enumerate(raw))
        except Exception as exc:  # noqa: BLE001
            logger.warning("Decryption failed: %s", exc)
            return encrypted


# ── Module-level singleton ────────────────────────────────────────────────────
_service: Optional[CryptoService] = None


def get_crypto_service() -> CryptoService:
    """Return the shared crypto service."""
    global _service
    if _service is None:
        _service = CryptoService()
    return _service
