FROM node:22.16.0-bookworm-slim

ENV NODE_ENV=production \
    SCARF_ANALYTICS=false \
    HOST=0.0.0.0 \
    PORT=55331

WORKDIR /workspace
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates msmtp \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY scripts/tooling-security.mjs scripts/tooling-security-patches.json ./scripts/
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --omit=dev --workspace @rafik/backend --workspace @rafik/shared

COPY packages/shared packages/shared
COPY apps/backend apps/backend
RUN npm run db:generate --workspace @rafik/backend \
    && mkdir -p /data/private-files \
    && chown -R node:node /data/private-files

WORKDIR /workspace/apps/backend
USER node
EXPOSE 55331
CMD ["node", "--import", "tsx", "server/index.ts"]
