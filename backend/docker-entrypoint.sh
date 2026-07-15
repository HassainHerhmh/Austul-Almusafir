#!/bin/sh
set -e

# على بعض مشاريع Railway العنوان الداخلي (.internal) يفشل —
# نفضّل MYSQL_PUBLIC_URL ثم MYSQL_URL ثم بناء الرابط يدوياً
if [ -n "$MYSQL_PUBLIC_URL" ]; then
  export DATABASE_URL="$MYSQL_PUBLIC_URL"
elif [ -n "$DATABASE_URL" ] && ! echo "$DATABASE_URL" | grep -Eq '127\.0\.0\.1|localhost|mysql://build:'; then
  : # استخدم DATABASE_URL إن كان مضبوطاً وليس وهمي البناء
elif [ -n "$MYSQL_URL" ]; then
  export DATABASE_URL="$MYSQL_URL"
elif [ -n "$MYSQLHOST" ]; then
  export DATABASE_URL="mysql://${MYSQLUSER}:${MYSQLPASSWORD}@${MYSQLHOST}:${MYSQLPORT:-3306}/${MYSQLDATABASE}"
fi

case "$DATABASE_URL" in
  *127.0.0.1*|*localhost*|*://build:*)
    echo "ERROR: DATABASE_URL محلي/وهمي: $DATABASE_URL"
    exit 1
    ;;
esac

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: على خدمة الـ API أضف:"
  echo "  DATABASE_URL = \${{MySQL.MYSQL_PUBLIC_URL}}"
  echo "  أو MYSQL_PUBLIC_URL عبر Variable Reference"
  echo "  و JWT_SECRET"
  exit 1
fi

echo "Prisma db push…"
npx prisma db push --skip-generate
echo "Seed…"
npx tsx prisma/seed.ts
echo "Starting API on port ${PORT:-8080}…"
exec node dist/index.js
