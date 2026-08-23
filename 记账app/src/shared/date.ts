// 日期工具：主进程与渲染进程共用
// 约定：账单日期为 YYYY-MM-DD，月份为 YYYY-MM；月份加减用整数运算，不用 Date（避免时区坑）

export function todayStr(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 校验 YYYY-MM-DD 格式且是真实存在的日期（本地时区回验） */
export function isValidDateStr(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  if (m < 1 || m > 12) return false
  const daysInMonth = new Date(y, m, 0).getDate()
  return d >= 1 && d <= daysInMonth
}

/** 月份加减：addMonths('2026-01', -1) === '2025-12' */
export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const total = y * 12 + (m - 1) + delta
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return `${String(ny).padStart(4, '0')}-${String(nm).padStart(2, '0')}`
}

/** 返回某月的 [首日, 末日]，如 monthRangeOf('2026-02') => ['2026-02-01', '2026-02-28'] */
export function monthRangeOf(month: string): [string, string] {
  const [y, m] = month.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  const mm = String(m).padStart(2, '0')
  return [`${y}-${mm}-01`, `${y}-${mm}-${String(lastDay).padStart(2, '0')}`]
}
