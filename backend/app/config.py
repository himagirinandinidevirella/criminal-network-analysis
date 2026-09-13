"""
Centralised application configuration.

All values are read from environment variables (optionally from a `.env` file)
so that no secrets are hardcoded anywhere in the codebase.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Load a local .env file if present (ignored when the file does not exist).
load_dotenv()


def _env(key: str, default: str) -> str:
    """Return an environment variable value or a default."""
    return os.getenv(key, default)


def _env_bool(key: str, default: bool = False) -> bool:
    """Parse a boolean environment variable."""
    return _env(key, "true" if default else "false").strip().lower() in {
        "1", "true", "yes", "on",
    }


def _env_int(key: str, default: int) -> int:
    """Parse an integer environment variable."""
    try:
        return int(_env(key, str(default)))
    except ValueError:
        return default


def _env_float(key: str, default: float) -> float:
    """Parse a float environment variable."""
    try:
        return float(_env(key, str(default)))
    except ValueError:
        return default


class Settings:
    """Singleton configuration object built from the environment."""

    def __init__(self) -> None:
        # ── Application ────────────────────────────────────────────────
        self.environment: str = _env("ENVIRONMENT", "development")
        self.app_name: str = _env("APP_NAME", "CrimeNet AI")
        self.debug: bool = _env_bool("DEBUG", False)

        # ── Neo4j ──────────────────────────────────────────────────────
        self.neo4j_uri: str = _env("NEO4J_URI", "bolt://localhost:7687")
        self.neo4j_user: str = _env("NEO4J_USER", "neo4j")
        self.neo4j_password: str = _env("NEO4J_PASSWORD", "crimenet2025")
        self.neo4j_database: str = _env("NEO4J_DATABASE", "neo4j")

        # ── PostgreSQL ─────────────────────────────────────────────────
        self.postgres_url: str = _env(
            "POSTGRES_URL",
            "postgresql://postgres:crimenet@localhost:5432/crimenetdb",
        )
        # Bound connection attempts so an unreachable database cannot stall requests.
        if "connect_timeout" not in self.postgres_url:
            sep = "&" if "?" in self.postgres_url else "?"
            self.postgres_url = f"{self.postgres_url}{sep}connect_timeout=3"

        # ── Redis ──────────────────────────────────────────────────────
        self.redis_url: str = _env("REDIS_URL", "redis://localhost:6379/0")

        # ── JWT / auth ─────────────────────────────────────────────────
        self.jwt_secret: str = _env("JWT_SECRET", "super-secret-jwt-key-crimenet-2025")
        self.jwt_algorithm: str = _env("JWT_ALGORITHM", "HS256")
        self.access_token_expire_minutes: int = _env_int("ACCESS_TOKEN_EXPIRE_MINUTES", 15)
        self.refresh_token_expire_days: int = _env_int("REFRESH_TOKEN_EXPIRE_DAYS", 7)
        self.bcrypt_rounds: int = _env_int("BCRYPT_ROUNDS", 12)

        # ── CORS ───────────────────────────────────────────────────────
        self.cors_origins: list[str] = [
            o.strip()
            for o in _env("CORS_ORIGINS", "http://localhost:3000,http://localhost").split(",")
            if o.strip()
        ]

        # ── ML configuration ───────────────────────────────────────────
        self.ml_load_models: bool = _env_bool("ML_LOAD_MODELS", True)
        self.nlp_model_name: str = _env("NLP_MODEL_NAME", "bert-base-multilingual-cased")
        self.nlp_confidence_threshold: float = _env_float("NLP_CONFIDENCE_THRESHOLD", 0.75)
        self.risk_model_path: str = _env("RISK_MODEL_PATH", "data/models/risk_xgb.json")
        self.cyber_model_path: str = _env("CYBER_MODEL_PATH", "backend/data/models/cyber_crime_clf.joblib")

        # ── Synthetic data seeding ─────────────────────────────────────
        self.load_synthetic_data: bool = _env_bool("LOAD_SYNTHETIC_DATA", True)
        self.synthetic_criminals: int = _env_int("SYNTHETIC_CRIMINALS", 500)
        self.synthetic_organizations: int = _env_int("SYNTHETIC_ORGANIZATIONS", 50)
        self.synthetic_locations: int = _env_int("SYNTHETIC_LOCATIONS", 200)

        # ── Security ───────────────────────────────────────────────────
        self.rate_limit_per_minute: int = _env_int("RATE_LIMIT_PER_MINUTE", 100)
        self.max_failed_login_attempts: int = _env_int("MAX_FAILED_LOGIN_ATTEMPTS", 5)
        self.session_timeout_hours: int = _env_int("SESSION_TIMEOUT_HOURS", 8)

        # ── Storage directories ────────────────────────────────────────
        backend_root = Path(__file__).resolve().parent.parent  # .../backend
        self.report_storage_dir: Path = Path(
            _env("REPORT_STORAGE_DIR", str(backend_root / "data" / "reports"))
        )
        self.evidence_storage_dir: Path = Path(
            _env("EVIDENCE_STORAGE_DIR", str(backend_root / "data" / "evidence"))
        )
        self.report_storage_dir.mkdir(parents=True, exist_ok=True)
        self.evidence_storage_dir.mkdir(parents=True, exist_ok=True)

        # ── Public sharing ─────────────────────────────────────────────
        self.share_base_url: str = _env(
            "SHARE_BASE_URL", "http://localhost:3000/public/report"
        )


# Module-level singleton used throughout the application.
settings = Settings()
