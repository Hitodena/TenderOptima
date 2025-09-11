#!/bin/bash

# Запуск серверной части в фоновом режиме
echo "Starting server..."
cd "$(dirname "$0")"
npm run dev &
SERVER_PID=$!

# Запуск клиентской части в фоновом режиме
echo "Starting client..."
cd "$(dirname "$0")/client"
npx vite --port 5000 --host 0.0.0.0 &
CLIENT_PID=$!

# Функция для корректного завершения всех процессов
cleanup() {
  echo "Stopping server and client..."
  kill $SERVER_PID
  kill $CLIENT_PID
  exit 0
}

# Реакция на сигналы завершения
trap cleanup SIGINT SIGTERM

# Бесконечный цикл, чтобы скрипт не завершался
while true; do
  sleep 1
  # Проверка, что оба процесса все еще запущены
  if ! ps -p $SERVER_PID > /dev/null || ! ps -p $CLIENT_PID > /dev/null; then
    echo "One of the processes died, restarting..."
    cleanup
    exit 1
  fi
done