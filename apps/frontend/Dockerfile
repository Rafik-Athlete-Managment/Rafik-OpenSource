FROM node:22.16.0-bookworm-slim AS build

WORKDIR /workspace
COPY package.json package-lock.json ./
COPY scripts/tooling-security.mjs scripts/tooling-security-patches.json ./scripts/
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --workspace @rafik/frontend --workspace @rafik/shared \
    && binding_arch="$(node -p 'process.arch === "arm64" ? "linux-arm64-gnu" : "linux-x64-gnu"')" \
    && npm install --prefix /tmp/rolldown-native --no-save --package-lock=false --ignore-scripts "@rolldown/binding-${binding_arch}@1.2.9" \
    && npm install --prefix /tmp/tailwind-native --no-save --package-lock=false --ignore-scripts "@tailwindcss/oxide-${binding_arch}@4.3.3" \
    && lightning_arch="$(node -p 'process.arch === "arm64" ? "linux-arm64-gnu" : "linux-x64-gnu"')" \
    && npm install --prefix /tmp/lightningcss-132 --no-save --package-lock=false --ignore-scripts "lightningcss-${lightning_arch}@1.32.0" \
    && npm install --prefix /tmp/lightningcss-133 --no-save --package-lock=false --ignore-scripts "lightningcss-${lightning_arch}@1.33.0" \
    && mkdir -p node_modules/@rolldown node_modules/@tailwindcss node_modules/@tailwindcss/node/node_modules node_modules \
    && cp -a "/tmp/rolldown-native/node_modules/@rolldown/binding-${binding_arch}" node_modules/@rolldown/ \
    && cp -a "/tmp/tailwind-native/node_modules/@tailwindcss/oxide-${binding_arch}" node_modules/@tailwindcss/ \
    && cp -a "/tmp/lightningcss-132/node_modules/lightningcss-${lightning_arch}" node_modules/@tailwindcss/node/node_modules/ \
    && cp -a "/tmp/lightningcss-133/node_modules/lightningcss-${lightning_arch}" node_modules/

COPY packages/shared packages/shared
COPY apps/frontend apps/frontend
ARG VITE_API_URL=/api
ARG VITE_LOCAL_PREVIEW=false
ENV VITE_API_URL=${VITE_API_URL} \
    VITE_LOCAL_PREVIEW=${VITE_LOCAL_PREVIEW}
RUN npm run build --workspace @rafik/frontend

FROM nginxinc/nginx-unprivileged:1.29.3-alpine
COPY apps/frontend/deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/frontend/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=12 --start-period=10s \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
