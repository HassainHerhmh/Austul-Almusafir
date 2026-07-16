const isProd = process.env.NODE_ENV === 'production'

const SENSITIVE =
  /password|passwd|token|secret|authorization|bearer|cookie|database_url|mysql/i

function redact(value: unknown): unknown {
  if (value == null) return value
  if (typeof value === 'string') {
    if (SENSITIVE.test(value)) return '[redacted]'
    if (value.length > 200) return `${value.slice(0, 80)}…[truncated]`
    return value
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: isProd ? sanitizeMessage(value.message) : value.message,
      ...(isProd ? {} : { stack: value.stack }),
    }
  }
  if (Array.isArray(value)) return value.map(redact)
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE.test(k) ? '[redacted]' : redact(v)
    }
    return out
  }
  return value
}

function sanitizeMessage(msg: string) {
  return msg
    .replace(/mysql:\/\/[^\s]+/gi, 'mysql://[redacted]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/password[=:]\s*\S+/gi, 'password=[redacted]')
}

/** لا نطبع بيانات حساسة — الإنتاج: رسائل مختصرة فقط */
export const logger = {
  info(message: string, meta?: unknown) {
    if (isProd && meta !== undefined) return
    if (meta !== undefined) console.log(message, redact(meta))
    else console.log(message)
  },

  warn(message: string, meta?: unknown) {
    if (meta !== undefined) console.warn(message, redact(meta))
    else console.warn(message)
  },

  error(context: string, err: unknown) {
    console.error(`[${context}]`, redact(err))
  },

  /** للرد على العميل — لا تفاصيل داخلية في الإنتاج */
  publicMessage(err: unknown, fallback = 'خطأ في الخادم') {
    if (!isProd && err instanceof Error && err.message) return err.message
    return fallback
  },
}
