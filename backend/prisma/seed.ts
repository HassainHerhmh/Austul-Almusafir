import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

// entrypoint يضبط DATABASE_URL؛ هذا احتياط إضافي داخل الحاوية
if (!process.env.DATABASE_URL && process.env.MYSQL_PUBLIC_URL) {
  process.env.DATABASE_URL = process.env.MYSQL_PUBLIC_URL
} else if (!process.env.DATABASE_URL && process.env.MYSQL_URL) {
  process.env.DATABASE_URL = process.env.MYSQL_URL
}

const prisma = new PrismaClient()

const chart: Array<{
  code: string
  nameAr: string
  nameEn?: string
  parentCode?: string
  level: 'رئيسي' | 'فرعي'
  statement?: string
}> = [
  { code: '1', nameAr: 'الأصول', nameEn: 'Assets', level: 'رئيسي', statement: 'الميزانية العمومية' },
  { code: '11', nameAr: 'الأصول المتداولة', parentCode: '1', level: 'رئيسي', statement: 'الميزانية العمومية' },
  { code: '111', nameAr: 'النقدية', parentCode: '11', level: 'رئيسي', statement: 'الميزانية العمومية' },
  { code: '11101', nameAr: 'الصندوق الرئيسي', parentCode: '111', level: 'فرعي', statement: 'الميزانية العمومية' },
  { code: '113', nameAr: 'الذمم المدينة', parentCode: '11', level: 'رئيسي', statement: 'الميزانية العمومية' },
  { code: '1131', nameAr: 'ذمم مكاتب السفريات', parentCode: '113', level: 'رئيسي', statement: 'الميزانية العمومية' },
  {
    code: '1132',
    nameAr: 'وسيط إيراد التذاكر',
    nameEn: 'Ticket Revenue Transit',
    parentCode: '113',
    level: 'فرعي',
    statement: 'الميزانية العمومية',
  },
  { code: '2', nameAr: 'الخصوم', nameEn: 'Liabilities', level: 'رئيسي', statement: 'الميزانية العمومية' },
  { code: '4', nameAr: 'الإيرادات', nameEn: 'Revenue', level: 'رئيسي', statement: 'أرباح وخسائر' },
  { code: '41', nameAr: 'إيرادات التذاكر', parentCode: '4', level: 'فرعي', statement: 'أرباح وخسائر' },
  { code: '5', nameAr: 'المصروفات', nameEn: 'Expenses', level: 'رئيسي', statement: 'أرباح وخسائر' },
  { code: '51', nameAr: 'مصروف الوقود', parentCode: '5', level: 'فرعي', statement: 'أرباح وخسائر' },
  {
    code: '53',
    nameAr: 'عمولات المكاتب',
    nameEn: 'Office Commissions Expense',
    parentCode: '5',
    level: 'فرعي',
    statement: 'أرباح وخسائر',
  },
]

async function main() {
  const count = await prisma.user.count()
  if (count === 0) {
    await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash: await bcrypt.hash('admin123', 10),
        name: 'مدير أسطول المسافر',
        role: 'admin',
        officeId: null,
        active: true,
      },
    })
  }

  const accCount = await prisma.account.count()
  if (accCount === 0) {
    const idByCode = new Map<string, number>()
    for (const row of chart) {
      const parentId = row.parentCode ? idByCode.get(row.parentCode) ?? null : null
      const created = await prisma.account.create({
        data: {
          code: row.code,
          nameAr: row.nameAr,
          nameEn: row.nameEn ?? null,
          parentId,
          accountLevel: row.level,
          financialStatement: row.statement ?? null,
        },
      })
      idByCode.set(row.code, created.id)
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('Seed complete')
  }
}

main()
  .catch(() => {
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
