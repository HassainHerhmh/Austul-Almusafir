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

# prisma generate يحتاج قيمة DATABASE_URL أثناء البناء فقط (ليست اتصال حقيقي)
ENV DATABASE_URL="mysql://build:build@127.0.0.1:3306/build"
RUN npx prisma generate && npx tsc

ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["./docker-entrypoint.sh"]
