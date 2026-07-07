# -----------------------------------------------------------------------------
# Stage 1: Dependencies Installation
# -----------------------------------------------------------------------------
FROM node:22.21.1-alpine AS dependencies

RUN apk upgrade --no-cache && \
    apk add --no-cache dumb-init curl bash

WORKDIR /app

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile --non-interactive && \
    yarn cache clean

# -----------------------------------------------------------------------------
# Stage 2: Build Application
# -----------------------------------------------------------------------------
FROM node:22.21.1-alpine AS builder

ENV NODE_ENV=production

RUN apk upgrade --no-cache && \
    apk add --no-cache curl bash && \
    curl -1sLf 'https://dl.cloudsmith.io/public/infisical/infisical-cli/setup.alpine.sh' | bash && \
    apk add --no-cache infisical

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json yarn.lock ./
COPY . .

# Vite reads environment variables at build time
# Infisical will inject VITE_* env vars automatically, so we only need Infisical credentials as build args
ARG INFISICAL_TOKEN
ARG INFISICAL_PROJECT_ID
ARG INFISICAL_API_URL
ARG DEPLOYMENT_ENVIRONMENT
ARG SECRET_PATH

RUN if [ -n "${INFISICAL_TOKEN}" ]; then \
      infisical run --token ${INFISICAL_TOKEN} --projectId=${INFISICAL_PROJECT_ID} --domain ${INFISICAL_API_URL} --env ${DEPLOYMENT_ENVIRONMENT} --path ${SECRET_PATH} --silent -- yarn build; \
    else \
      yarn build; \
    fi

# -----------------------------------------------------------------------------
# Stage 3: Production Runtime
# -----------------------------------------------------------------------------
FROM node:22.21.1-alpine AS production

ENV NODE_ENV=production

RUN apk upgrade --no-cache && \
    apk add --no-cache dumb-init bash ca-certificates curl && \
    curl -1sLf 'https://dl.cloudsmith.io/public/infisical/infisical-cli/setup.alpine.sh' | bash && \
    apk add --no-cache infisical && \
    infisical --version

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S vitejs -u 1001 -G nodejs

COPY --from=builder --chown=vitejs:nodejs /app/dist ./dist
COPY --from=builder --chown=vitejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=vitejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=vitejs:nodejs /app/scripts ./scripts

USER vitejs

EXPOSE 5002

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
    CMD curl -fsS "http://localhost:${PORT:-5002}/" >/dev/null || exit 1

ENTRYPOINT ["/bin/bash", "-c", "infisical run --watch --token ${INFISICAL_TOKEN} --projectId=${INFISICAL_PROJECT_ID} --domain ${INFISICAL_API_URL} --env ${DEPLOYMENT_ENVIRONMENT} --path ${SECRET_PATH} --silent -- dumb-init -- node ./scripts/serve-dist.mjs"]

# CMD ["dumb-init", "./node_modules/.bin/vite", "preview", "--host", "0.0.0.0", "--port", "5002", "--strictPort"]
