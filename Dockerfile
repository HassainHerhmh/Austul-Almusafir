# يُبنى من جذر المستودع — يضم مجلد backend فقط
FROM node:22-alpine

WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./
RUN npm install

COPY backend/prisma ./prisma
COPY backend/src ./src
COPY backend/tsconfig.json ./

RUN npx prisma generate && npx tsc

ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "npx prisma db push && npx tsx prisma/seed.ts && node dist/index.js"]
