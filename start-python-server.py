#!/usr/bin/env python3
"""
Запускающий скрипт для Python FastAPI сервера
"""
import sys
import os
from pathlib import Path
import uvicorn

# Добавляем корневую папку проекта в Python path
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

if __name__ == "__main__":
    print("🚀 Запуск Python FastAPI сервера на порту 8080...")
    # Запускаем uvicorn, указывая путь к модулю и переменной app
    uvicorn.run("parsers.fastapi_server:app", host="0.0.0.0", port=8080, reload=True)
