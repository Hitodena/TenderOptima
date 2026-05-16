from enum import StrEnum
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

from app import ENV_FILE


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
    redis_port_inner: int
    redis_password: str

    # PostgreSQL
    postgres_user: str
    postgres_password: str
    postgres_db: str
    postgres_host: str
    postgres_port_inner: int

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

    def build_db_url(self) -> str:
        """Build SQLAlchemy URL scheme

        Returns:
                str: URL scheme
        """
        return f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}@{self.postgres_host}:{self.postgres_port_inner}/{self.postgres_db}"


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
