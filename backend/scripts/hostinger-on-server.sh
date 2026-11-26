#!/usr/bin/env bash
# نفّذ هذا السكربت **على Hostinger** بعد: ssh -p 65002 u608667573@2.24.166.105
# من جذر المستودع (مجلد فيه backend/ و package.json للواجهة)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

echo "==> git pull"
git pull origin main

echo "==> backend setup"
cd backend
npm run setup:hostinger

if [[ -f .env.tlb ]]; then
  echo "==> تحديث مفاتيح الهيئة من .env.tlb"
  set -a
  # shellcheck disable=SC1091
  source .env.tlb
  set +a
  npm run tlb:upsert-key
else
  echo "تخطي TLB: أنشئ backend/.env.tlb من .env.tlb.example ثم أعد التشغيل"
fi

echo ""
echo "تم. من hPanel: Websites → Node.js → Restart للتطبيق API."