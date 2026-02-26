# syntax=docker/dockerfile:1
# Photomagic - Next.js app for Azure VM

# ---- Base ----
FROM node:20-slim AS base
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# ---- Build ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Create a seed database with migrations applied
RUN DATABASE_URL="file:./seed.db" npx prisma migrate deploy

# ---- Runner ----
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy generated Prisma client, seed database, and migrations
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder --chown=nextjs:nodejs /app/seed.db ./seed.db
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts

# Data dir for SQLite (when using file: DATABASE_URL)
RUN mkdir -p /app/data && chown nextjs:nodejs /app/data

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Seed DB if first run, then apply any pending migrations, then start
CMD ["sh", "-c", "if [ ! -f /app/data/photomagic.db ]; then cp /app/seed.db /app/data/photomagic.db; echo '[init] Created database from seed'; fi && npx prisma migrate deploy && node server.js"]
