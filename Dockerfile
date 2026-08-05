FROM node:22-alpine AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build

COPY tsconfig.json tsconfig.server.json vite.config.ts vitest.config.ts ./
COPY client ./client
COPY server ./server
COPY shared ./shared
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/server/db/migrations ./server/db/migrations

USER node
EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1

CMD ["npm", "start"]
