# أسطول المسافر

منصة مركزية لإدارة مكاتب السفريات — رحلات، باصات، مقاعد، حجوزات، ومحاسبة.

المستودع: [HassainHerhmh/Austul-Almusafir](https://github.com/HassainHerhmh/Austul-Almusafir)

## التشغيل محلياً

```bash
npm install
npm run dev
```

## حساب المدير الافتراضي

| المستخدم | كلمة المرور |
|---------|------------|
| `admin` | `admin123` |

ابدأ بإضافة المكاتب والمستخدمين والوجهات والباصات من لوحة المدير. لا توجد بيانات تجريبية.

## الربط بالسيرفر

حالياً الواجهة تعمل بتخزين محلي (`localStorage`). لربط API حقيقي لاحقاً عيّن عنوان السيرفر في `.env`:

```env
VITE_API_URL=https://your-api.example.com
```

## البناء للإنتاج

```bash
npm run build
```

المخرجات في مجلد `dist/` جاهزة للنشر على أي استضافة static (Nginx، cPanel، Vercel، …).
