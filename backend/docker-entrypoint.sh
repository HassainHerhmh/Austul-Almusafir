#!/bin/sh
set -e

# تفضيل متغيرات MySQL من Railway دائماً (لا تستخدم DATABASE_URL الخاص بالبناء)
if [ -n "$MYSQL_URL" ]; then
  export DATABASE_URL="$MYSQL_URL"
elif [ -n "$MYSQL_PUBLIC_URL" ]; then
  export DATABASE_URL="$MYSQL_PUBLIC_URL"
elif [ -n "$MYSQLHOST" ]; then
  export DATABASE_URL="mysql://${MYSQLUSER}:${MYSQLPASSWORD}@${MYSQLHOST}:${MYSQLPORT:-3306}/${MYSQLDATABASE}"
fi

# تجاهل رابط البناء الوهمي إن وُجد
case "$DATABASE_URL" in
  *127.0.0.1*|*localhost*|*@build:*|*://build:*)
    echo "ERROR: DATABASE_URL ما زال يشير لمحلي ($DATABASE_URL)"
    echo "اربط خدمة MySQL بالمشروع ومرّر MYSQL_URL إلى خدمة الـ API (Variable reference)."
    exit 1
    ;;
esac

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: أضف MYSQL_URL أو DATABASE_URL لخدمة الـ API على Railway"
  exit 1
fi

echo "Using database host from DATABASE_URL…"
echo "Prisma db push…"
npx prisma db push --skip-generate
echo "Seed…"
npx tsx prisma/seed.ts
echo "Starting API on port ${PORT:-8080}…"
exec node dist/index.js
