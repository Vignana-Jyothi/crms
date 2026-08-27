FROM node:20-bookworm-slim AS prisma-build

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate

FROM node:20-bookworm-slim

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=prisma-build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=prisma-build /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY prisma ./prisma
COPY src ./src

EXPOSE 4000

CMD ["node", "src/server.js"]
