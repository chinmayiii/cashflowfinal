"""Configuration module for loading settings from environment variables."""

from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict

_ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
_ENV_FILE = _ROOT_DIR / ".env"


class Settings(BaseSettings):
    """Application settings using pydantic-settings."""

    APP_NAME: str = "AI-Based Micro-Business Cashflow Management System"
    VERSION: str = "0.1.0"
    DEBUG: bool = False

    # ── Database ──────────────────────────────────────────────
    DATABASE_URL: str = "sqlite+aiosqlite:///cashflow.db"

    # ── JWT Auth ──────────────────────────────────────────────
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days

    # ── Google OAuth ──────────────────────────────────────────
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None

    # ── SMTP (email verification) ─────────────────────────────
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: Optional[str] = None
    SMTP_FROM_NAME: str = "CashflowAI"

    # ── Frontend ──────────────────────────────────────────────
    FRONTEND_URL: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env", str(_ENV_FILE)),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
