FROM node:20-slim AS build
WORKDIR /app
# node:20-slim (Debian) has no OpenSSL — Prisma's query/schema engine needs
# it to detect the libssl version, otherwise it silently falls back to a
# guess and can fail engine calls (e.g. `prisma migrate deploy`) at runtime.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate
COPY --from=build /app/dist ./dist

EXPOSE 3000
# Terapkan migration yang belum jalan sebelum start — aman untuk deploy
# single-instance Coolify (bukan multi-replica), sesuai pola project ini.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
