# يُبنى من جذر المستودع — يضم مجلد backend فقط
FROM node:22-alpine

WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./
RUN npm install

COPY backend/prisma ./prisma
COPY backend/src ./src
COPY backend/tsconfig.json ./
COPY backend/docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x docker-entrypoint.sh

# للاستخدام أثناء prisma generate فقط — يُمسَح بعدها حتى لا يبقى في التشغيل
ARG PRISMA_BUILD_URL="mysql://build:build@127.0.0.1:3306/build"
RUN DATABASE_URL="$PRISMA_BUILD_URL" npx prisma generate \
  && DATABASE_URL="$PRISMA_BUILD_URL" npx tsc

# لا تُثبّت DATABASE_URL في صورة التشغيل
ENV DATABASE_URL=""
ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["./docker-entrypoint.sh"]
