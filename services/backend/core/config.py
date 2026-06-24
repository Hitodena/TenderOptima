from enum import StrEnum
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

from backend import ENV_FILE

ALLOWED_CONTENT_TYPES: set[str] = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "image/jpeg",
    "image/png",
    "image/webp",
    "text/plain",
}


class LogLevel(StrEnum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"


class AppEnvironment(StrEnum):
    DEV = "dev"
    PROD = "prod"


class Config(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_FILE,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Redis
    redis_host: str
    redis_port: int
    redis_password: str

    # PostgreSQL
    postgres_user: str
    postgres_password: str
    postgres_db: str
    postgres_host: str
    postgres_port: int

    # Logging
    log_level: LogLevel

    # Environment
    app_environment: AppEnvironment

    # SMTP
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_password: str

    # IMAP
    imap_host: str
    imap_port: int
    imap_user: str
    imap_password: str

    # Auth
    secret_key: str
    alghoritm: str

    # Parser
    parser_url: str

    # OpenAI
    openai_api_key: str
    openai_model: str
    openai_base_url: str

    # Upload
    upload_dir: str = "/app/uploads"
    max_upload_files: int = 2
    max_upload_size: int = 10 * 1024 * 1024
    max_tz_upload_size: int = 100 * 1024 * 1024

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]
    cors_allow_credentials: bool = True
    cors_allow_methods: str = "*"
    cors_allow_headers: str = "*"

    def build_db_url(self) -> str:
        """Build SQLAlchemy URL scheme

        Returns:
                str: URL scheme
        """
        return f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"


class ProdConfig(Config):
    debug: bool = False


class DevConfig(Config):
    debug: bool = True


@lru_cache
def get_config() -> Config:
    env = Config().app_environment  # type: ignore
    if env == AppEnvironment.PROD:
        return ProdConfig()  # type: ignore
    return DevConfig()  # type: ignore
