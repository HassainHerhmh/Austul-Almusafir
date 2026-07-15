# أسطول المسافر

## الباك اند (Railway)

مجلد **`backend/`** — Node.js API على:
`https://ostool-almosafer.com`

```bash
cd backend
npm install
npm run setup
npm run dev
```

التفاصيل: [backend/README.md](backend/README.md)

## الواجهة (Vercel)

جذر المشروع = React/Vite. اربطه بنفس GitHub:

1. [vercel.com](https://vercel.com) → Add New Project → اختر `HassainHerhmh/Austul-Almusafir`
2. Framework Preset: **Vite** — Root Directory اتركه فارغ (الجذر)
3. Environment Variables:
   - Name: `VITE_API_URL`
   - Value: `https://ostool-almosafer.com`
4. Deploy

محلياً:

```bash
npm install
npm run dev
```

حساب المدير: `admin` / `admin123`
