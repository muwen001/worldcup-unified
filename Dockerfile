# Server runtime image.
# - Client is pre-built locally (client/dist) and copied in (avoids heavy vite build).
# - Server runs via tsx (same as dev) to bypass pre-existing TS strict errors.

FROM node:20-alpine AS deps
WORKDIR /app
COPY server/package.json server/package-lock.json ./
# npm ci installs devDeps too -> includes tsx needed at runtime
RUN npm ci

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001 \
    BASE_PATH=/worldcup \
    STATIC_DIR=/app/public
COPY --from=deps /app/node_modules ./node_modules
COPY server/package.json ./
COPY server/src ./src
COPY server/tsconfig.json ./
COPY client/dist ./public
EXPOSE 3001
CMD ["npx", "tsx", "src/app.ts"]
