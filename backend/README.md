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