# أسطول المسافر — Backend API (Node.js)

REST API حقيقي بـ **Node.js + Express + Prisma + SQLite** (يمكن التحويل إلى PostgreSQL للإنتاج).

المستودع: https://github.com/HassainHerhmh/Austul-Almusafir

## التشغيل

```bash
cd backend
cp .env.example .env
npm install
npm run setup
npm run dev
```

السيرفر: `http://localhost:4000`

فحص الصحة: `GET /api/health`

## حساب المدير الافتراضي

| المستخدم | كلمة المرور |
|---------|------------|
| `admin` | `admin123` |

## المصادقة

```http
POST /api/auth/login
Content-Type: application/json

{ "username": "admin", "password": "admin123" }
```

ثم أرسل التوكن في الطلبات:

```http
Authorization: Bearer <token>
```

## أهم المسارات

| الطريقة | المسار | الوصف |
|--------|--------|------|
| POST | `/api/auth/login` | تسجيل الدخول |
| GET | `/api/auth/me` | المستخدم الحالي |
| GET/POST/PUT | `/api/offices` | المكاتب |
| GET | `/api/offices/:id/balance` | رصيد المكتب لدى الوكالة |
| GET/POST/PUT | `/api/users` | المستخدمون |
| GET/POST | `/api/destinations` | الوجهات |
| GET/POST | `/api/buses` | الباصات |
| GET/POST | `/api/drivers` | السائقون |
| GET/POST/PUT | `/api/trips` | الرحلات |
| GET | `/api/trips/:id/seats` | حالة المقاعد |
| GET/POST/PATCH | `/api/bookings` | الحجوزات (+ ترحيل محاسبي) |
| GET/POST | `/api/customers` | العملاء |
| GET/POST | `/api/vouchers` | السندات |
| GET | `/api/accounts` | دليل الحسابات |
| GET | `/api/accounts/sub` | الحسابات الفرعية فقط |

عند تأكيد الحجز يُرحَّل القيد آلياً: مدين ذمم المكتب / دائن إيرادات التذاكر.

## الإنتاج (Railway + MySQL)

Railway يوفّر عادةً `MYSQL_URL` / `MYSQLHOST`. للإتصال السريع:

1. **فضّل الشبكة الداخلية:** اربط `MYSQL_PRIVATE_URL` أو تأكد أن `MYSQLHOST` = `*.railway.internal`  
2. كاحتياط يعمل `MYSQL_PUBLIC_URL` (أبطأ)  
3. `JWT_SECRET=قيمة-طويلة-عشوائية`

ثم Redeploy. التطبيق يختار الرابط الداخلي تلقائياً إن وُجد.

## Hostinger (MySQL)

بعد كل تحديث لـ `schema.prisma`، التطبيق في **الإنتاج** يشغّل تلقائياً `prisma db push` عند التشغيل (ما لم تضبط `DB_AUTO_SYNC=0`).

يدوياً:

```bash
npm run setup:hostinger
```

أو `npm run db:sync` ثم إعادة تشغيل Node.

### SSH (Hostinger)

```text
ssh -p 65002 u608667573@2.24.166.105
```

(من Windows: `powershell -File scripts/ssh-hostinger.ps1`)

بعد الدخول، من **جذر المستودع** على السيرفر:

```bash
bash backend/scripts/hostinger-on-server.sh
```

مفاتيح الهيئة: انسخ `backend/.env.tlb.example` إلى `backend/.env.tlb` على السيرفر (قيم من خطاب الهيئة)، ثم شغّل السكرب أعلاه أو `npm run tlb:upsert-key`.