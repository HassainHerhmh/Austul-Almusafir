#!/bin/sh
set -e

# MYSQL_PUBLIC_URL أولاً — العنوان الداخلي mysql.railway.internal يفشل على بعض المشاريع
pick_db_url() {
  if [ "$FORCE_PRIVATE_MYSQL" = "1" ] && [ -n "$MYSQL_PRIVATE_URL" ]; then
    echo "$MYSQL_PRIVATE_URL"
    return
  fi
  if [ -n "$MYSQL_PUBLIC_URL" ]; then
    echo "$MYSQL_PUBLIC_URL"
    return
  fi
  if [ -n "$DATABASE_URL" ] && ! echo "$DATABASE_URL" | grep -q 'railway.internal'; then
    if ! echo "$DATABASE_URL" | grep -Eq '127\.0\.0\.1|localhost|mysql://build:'; then
      echo "$DATABASE_URL"
      return
    fi
  fi
  if [ -n "$MYSQL_URL" ] && ! echo "$MYSQL_URL" | grep -q 'railway.internal'; then
    echo "$MYSQL_URL"
    return
  fi
  if [ -n "$MYSQLHOST" ] && ! echo "$MYSQLHOST" | grep -q 'railway.internal'; then
    echo "mysql://${MYSQLUSER}:${MYSQLPASSWORD}@${MYSQLHOST}:${MYSQLPORT:-3306}/${MYSQLDATABASE}"
    return
  fi
  # آخر محاولة: حتى لو كان داخلياً (قد يعمل في بعض البيئات)
  if [ -n "$DATABASE_URL" ] && ! echo "$DATABASE_URL" | grep -Eq '127\.0\.0\.1|localhost|mysql://build:'; then
    echo "$DATABASE_URL"
    return
  fi
  if [ -n "$MYSQL_URL" ]; then
    echo "$MYSQL_URL"
    return
  fi
  echo ""
}

export DATABASE_URL="$(pick_db_url)"

case "$DATABASE_URL" in
  *127.0.0.1*|*localhost*|*://build:*|"")
    echo "ERROR: DATABASE_URL محلي/وهمي أو فارغ"
    echo "  على خدمة الـ API أضف: MYSQL_PUBLIC_URL = \${{MySQL.MYSQL_PUBLIC_URL}}"
    echo "  و JWT_SECRET"
    exit 1
    ;;
esac

if echo "$DATABASE_URL" | grep -q 'railway.internal'; then
  echo "DB: private network (قد يفشل إن لم يكن الـ Private Networking مفعّلاً)"
else
  echo "DB: public MySQL URL"
fi

echo "Prisma db push…"
npx prisma db push --skip-generate
echo "Seed…"
npx tsx prisma/seed.ts
echo "Starting API on port ${PORT:-8080}…"
exec node dist/index.js
