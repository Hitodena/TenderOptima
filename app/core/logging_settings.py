import sys
from pathlib import Path

from loguru import logger

from app.core.config import Config, LogLevel


class LoggerSettings:
    def __init__(self, config: Config, modules: list[str] | None = None):
        self.config = config
        self.modules = modules

    def setup_logger(self) -> None:
        """Setup logger"""
        # Formatting
        log_level = self.config.log_level
        file_level = self.config.log_level_file
        console_format: str = (
            "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
            "<level>{level}</level> | "
            "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "  # noqa: E501
            "<level>{message}</level>"
            " <dim>({extra})</dim>"
        )
        file_format: str = (
            "{time:YYYY-MM-DD HH:mm:ss} | "
            "{level} | "
            "{name}:{function}:{line} | "
            "{message} | {extra}"
        )

        # Storage
        rotation = "10 MB"
        retention = "7 days"
        compression = "zip"

        # Settings
        serialize = False
        backtrace = True
        diagnose = False
        enqueue = True

        # Folder
        log_dir: Path = Path("logs")
        if not log_dir.exists():
            log_dir.mkdir(parents=True, exist_ok=True)

        # Setup
        logger.remove()
        logger.add(
            sys.stderr,
            level=log_level,
            format=console_format,
            colorize=True,
            backtrace=backtrace,
            diagnose=diagnose,
            enqueue=enqueue,
        )
        logger.add(
            log_dir / "errors.log",
            level=LogLevel.ERROR,
            format=file_format,
            rotation=rotation,
            retention=retention,
            compression=compression,
            serialize=serialize,
            backtrace=backtrace,
            diagnose=diagnose,
            enqueue=enqueue,
        )

        if self.modules:
            for module_name in self.modules:
                logger.add(
                    log_dir / f"{module_name.replace('.', '_')}.log",
                    level=file_level,
                    format=file_format,
                    filter=module_name,
                    rotation=rotation,
                    retention=retention,
                    compression=compression,
                    serialize=serialize,
                    backtrace=backtrace,
                    diagnose=diagnose,
                    enqueue=enqueue,
                )
