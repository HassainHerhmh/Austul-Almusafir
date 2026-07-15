#!/bin/sh
set -e

# Prisma يحتاج DATABASE_URL — على Railway غالباً يوجد MYSQL_URL فقط
if [ -z "$DATABASE_URL" ]; then
  if [ -n "$MYSQL_URL" ]; then
    export DATABASE_URL="$MYSQL_URL"
  elif [ -n "$MYSQLHOST" ]; then
    export DATABASE_URL="mysql://${MYSQLUSER}:${MYSQLPASSWORD}@${MYSQLHOST}:${MYSQLPORT:-3306}/${MYSQLDATABASE}"
  fi
fi

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL أو MYSQL_URL مطلوب"
  exit 1
fi

echo "Prisma db push…"
npx prisma db push --skip-generate
echo "Seed…"
npx tsx prisma/seed.ts
echo "Starting API on port ${PORT:-8080}…"
exec node dist/index.js
