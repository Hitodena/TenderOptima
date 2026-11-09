# The site is built on GitHub Actions (the server has too little memory for
# `nuxt build`); CI uploads the result to ./prebuilt before `docker compose`.
FROM node:26-alpine
WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --chown=appuser:appgroup prebuilt/.output /app/.output

USER appuser
EXPOSE 3000
ENV NODE_ENV=production

CMD ["node", ".output/server/index.mjs"]
