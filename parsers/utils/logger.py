import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

root = Path(__file__).resolve().parent.parent
log_folder = root / "logs"
log_folder.mkdir(parents=True, exist_ok=True)


class CustomLogger:
    def __init__(
        self, logger_name: str, file_path: str, debug: bool = False, console: bool = False
    ) -> None:

        self.__logger = logging.getLogger(logger_name)
        self.__file_path = log_folder / file_path
        self.debug = debug
        self.console = console

        if not self.__logger.handlers:
            try:
                self.setup_logging()
            except Exception as e:
                self.__logger.critical(f"Error setting up logging: {e}")
                raise

    def setup_logging(self) -> None:
        file_handler = RotatingFileHandler(
            self.__file_path, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8"
        )
        console_handler = logging.StreamHandler()

        formatter = logging.Formatter(
            "%(asctime)s - [%(levelname)s] - %(name)s - %(message)s", "%d-%m-%Y %H:%M:%S"
        )

        file_handler.setFormatter(formatter)
        console_handler.setFormatter(formatter)

        self.__logger.addHandler(file_handler)

        if self.console:
            self.__logger.addHandler(console_handler)

        if self.debug:
            self.__logger.setLevel(logging.DEBUG)
        else:
            self.__logger.setLevel(logging.INFO)

    def get_logger(self) -> logging.Logger:
        return self.__logger