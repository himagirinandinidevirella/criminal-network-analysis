"""
IPFS storage service for evidence files.

Uploads evidence to a local IPFS node (http://localhost:5001) when available;
otherwise stores files in a content-addressed local directory and returns a
deterministic pseudo-CID so the rest of the pipeline is identical in both
modes. Retrieval (`get_file`) works from either backend.
"""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import os
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger("crimenet.ipfs")

IPFS_API = os.getenv("IPFS_API_URL", "http://localhost:5001")
IPFS_GATEWAY = os.getenv("IPFS_GATEWAY_URL", "http://localhost:8080")
_BACKEND_ROOT = Path(__file__).resolve().parents[2]  # .../backend
LOCAL_STORE = Path(os.getenv("CRIMENET_IPFS_DIR", str(_BACKEND_ROOT / "data" / "ipfs")))

# Base58 alphabet used for realistic-looking CIDs.
_B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def _base58_encode(data: bytes) -> str:
    """Encode bytes as a base58 string (Bitcoin-style alphabet)."""
    n = int.from_bytes(data, "big")
    out = ""
    while n > 0:
        n, rem = divmod(n, 58)
        out = _B58[rem] + out
    # Preserve leading zero bytes as '1'.
    pad = 0
    for b in data:
        if b == 0:
            pad += 1
        else:
            break
    return "1" * pad + (out or "1")


class IPFSService:
    """Content-addressed file storage with an IPFS-compatible interface."""

    def __init__(self) -> None:
        self._client: Optional[Any] = None
        self.mode = "local"
        LOCAL_STORE.mkdir(parents=True, exist_ok=True)
        self._init_client()

    def _init_client(self) -> None:
        try:
            import ipfshttpclient  # noqa: PLC0415

            self._client = ipfshttpclient.connect(IPFS_API)
            self.mode = "ipfs"
            logger.info("IPFS node connected at %s", IPFS_API)
        except Exception as exc:  # noqa: BLE001
            logger.warning("IPFS unavailable (%s); using local content store", exc)

    @property
    def available(self) -> bool:
        return self.mode == "ipfs"

    # ── Upload ────────────────────────────────────────────────────────────────
    async def upload_file(self, file_bytes: bytes, filename: str = "file") -> str:
        """Upload raw bytes; return the content identifier (CID)."""
        if self._client is not None:
            try:
                result = self._client.add_bytes(file_bytes)
                return str(result)
            except Exception as exc:  # noqa: BLE001
                logger.warning("IPFS upload failed (%s); local fallback", exc)
        cid = self._local_cid(file_bytes)
        (LOCAL_STORE / cid).write_bytes(file_bytes)
        return cid

    async def upload_json(self, data: dict[str, Any]) -> str:
        """Upload a JSON document; return its CID."""
        return await self.upload_file(
            json.dumps(data, sort_keys=True, default=str).encode("utf-8"), "data.json"
        )

    # ── Retrieval ─────────────────────────────────────────────────────────────
    async def get_file(self, cid: str) -> bytes:
        """Retrieve file contents by CID."""
        if self._client is not None:
            try:
                return self._client.cat(cid)
            except Exception as exc:  # noqa: BLE001
                logger.debug("IPFS cat failed (%s); trying local store", exc)
        local = LOCAL_STORE / cid
        if local.exists():
            return local.read_bytes()
        raise FileNotFoundError(f"CID {cid} not found in IPFS or local store")

    async def pin_file(self, cid: str) -> bool:
        """Pin a CID to prevent garbage collection."""
        if self._client is not None:
            try:
                self._client.pin.add(cid)
                return True
            except Exception as exc:  # noqa: BLE001
                logger.debug("IPFS pin failed: %s", exc)
        return (LOCAL_STORE / cid).exists()

    def get_ipfs_gateway_url(self, cid: str) -> str:
        """Public gateway URL for a CID."""
        if self._client is not None:
            return f"{IPFS_GATEWAY}/ipfs/{cid}"
        return f"https://ipfs.io/ipfs/{cid}"

    # ── Helpers ───────────────────────────────────────────────────────────────
    @staticmethod
    def _local_cid(file_bytes: bytes) -> str:
        """Deterministic content-addressed pseudo-CID (SHA-256 based)."""
        digest = hashlib.sha256(file_bytes).digest()
        # 0x12 = sha2-256, 0x20 = 32-byte digest → realistic multihash prefix.
        multihash = b"\x12\x20" + digest
        return "Qm" + _base58_encode(multihash)


# ── Module-level singleton ────────────────────────────────────────────────────
_service: Optional[IPFSService] = None


def get_ipfs_service() -> IPFSService:
    """Return the shared IPFS service."""
    global _service
    if _service is None:
        _service = IPFSService()
    return _service
