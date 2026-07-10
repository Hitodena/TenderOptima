"""Shared test bootstrap for backend tests."""

import os

TEST_ENV = {
    "REDIS_HOST": "localhost",
    "REDIS_PORT": "6379",
    "REDIS_PASSWORD": "test",
    "POSTGRES_USER": "test",
    "POSTGRES_PASSWORD": "test",
    "POSTGRES_DB": "test",
    "POSTGRES_HOST": "localhost",
    "POSTGRES_PORT": "5432",
    "LOG_LEVEL": "INFO",
    "APP_ENVIRONMENT": "dev",
    "SMTP_HOST": "localhost",
    "SMTP_PORT": "1025",
    "SMTP_USER": "test",
    "SMTP_PASSWORD": "test",
    "IMAP_HOST": "localhost",
    "IMAP_PORT": "993",
    "IMAP_USER": "test",
    "IMAP_PASSWORD": "test",
    "SECRET_KEY": "test-secret",
    "ALGHORITM": "HS256",
    "PARSER_URL": "http://localhost:8010/search",
    "OPENAI_API_KEY": "test",
    "OPENAI_MODEL": "test-model",
    "OPENAI_BASE_URL": "http://localhost:11434/v1",
}

for key, value in TEST_ENV.items():
    os.environ.setdefault(key, value)
