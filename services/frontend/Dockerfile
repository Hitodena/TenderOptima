FROM node:26-alpine AS builder
WORKDIR /app

# Harden against flaky registry connectivity on remote builders.
# Prefer IPv4: Docker DNS often returns AAAA first while IPv6 is broken/slow,
# which surfaces as ETIMEDOUT during npm ci.
ENV NODE_OPTIONS=--dns-result-order=ipv4first \
	NPM_CONFIG_FETCH_RETRIES=5 \
	NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
	NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
	NPM_CONFIG_FETCH_TIMEOUT=300000 \
	NPM_CONFIG_MAXSOCKETS=10

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:26-alpine AS runner
WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder --chown=appuser:appgroup /app/.output /app/.output

USER appuser
EXPOSE 3000
ENV NODE_ENV=production

CMD ["node", ".output/server/index.mjs"]
