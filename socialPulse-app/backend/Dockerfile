# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Install build tools for native modules (like sharp)
RUN apk add --no-cache make gcc g++ python3 vips-dev

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Production stage
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 5000

CMD ["node", "dist/server.js"]
