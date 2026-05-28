import sys

from loguru import logger

from backend.core.config import Config


class LoggerSettings:
    def __init__(self, config: Config):
        self.config = config

    def setup_logger(self) -> None:
        """Setup logger"""
        # Formatting
        log_level = self.config.log_level
        console_format: str = (
            "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
            "<level>{level}</level> | "
            "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> | "  # noqa: E501
            "<level>{message}</level>"
            " <dim>({extra})</dim>"
        )

        # Settings
        serialize = False
        backtrace = True
        diagnose = False
        enqueue = True

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
            serialize=serialize,
        )
