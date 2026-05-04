import sys
from os import getenv

if "pytest" in sys.modules:
    ENV_FILE = ".env.test"
else:
    ENV_FILE = getenv("ENV_FILE", ".env.dev")
