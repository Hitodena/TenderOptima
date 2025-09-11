#!/usr/bin/env python3
"""
Запускающий скрипт для Python FastAPI сервера
"""
import sys
import os
from pathlib import Path

# Добавляем текущую папку в Python path
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir))

# Импортируем и запускаем сервер
if __name__ == "__main__":
    import uvicorn
    from parsers.main import app
    
    print("🚀 Запуск Python FastAPI сервера на порту 8080...")
    uvicorn.run(app, host="0.0.0.0", port=8080)
