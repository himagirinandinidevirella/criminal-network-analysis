# ─────────────────────────────────────────────────────────────
# CrimeNet AI — Frontend image
# Multi-stage: build the static bundle, serve with a tiny preview server.
# In production nginx can serve the dist/ folder directly.
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# ── Serve stage ──────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

RUN npm install -g serve@14 --silent

COPY --from=build /app/dist ./dist

EXPOSE 3000

CMD ["serve", "-s", "dist", "-l", "3000"]
