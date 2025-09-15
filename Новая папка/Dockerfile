# --- Build Stage ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

# --- Production Stage ---
FROM node:20-alpine
WORKDIR /app

# ОСНОВНЫЕ файлы
COPY --from=builder /app/package.json /app/package-lock.json* ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/client ./client
COPY --from=builder /app/vite.config.ts ./vite.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/theme.json ./theme.json

# КОНФИГУРАЦИОННЫЕ ФАЙЛЫ
COPY --from=builder /app/tailwind.config.ts ./tailwind.config.ts
COPY --from=builder /app/postcss.config.js ./postcss.config.js
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

# ENV ФАЙЛЫ (если существуют)
COPY --from=builder /app/.env* ./
COPY --from=builder /app/env.* ./

# РЕСУРСЫ И СКРИПТЫ
COPY --from=builder /app/attached_assets ./attached_assets

# ВСЕ Python скрипты в корне
COPY --from=builder /app/yandex_search*.py ./
COPY --from=builder /app/extract_text*.py ./
COPY --from=builder /app/main.py ./main.py
COPY --from=builder /app/start-python-server.py ./start-python-server.py

# Создаем ВСЕ необходимые директории
RUN mkdir -p uploads/analysis
RUN mkdir -p attachments
RUN mkdir -p temp
RUN mkdir -p logs

EXPOSE 5000
CMD ["npx", "tsx", "server/index.ts"]