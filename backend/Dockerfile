FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json ./
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x docker-entrypoint.sh

ARG PRISMA_BUILD_URL="mysql://build:build@127.0.0.1:3306/build"
RUN DATABASE_URL="$PRISMA_BUILD_URL" npx prisma generate \
  && DATABASE_URL="$PRISMA_BUILD_URL" npx tsc

ENV DATABASE_URL=""
ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["./docker-entrypoint.sh"]
