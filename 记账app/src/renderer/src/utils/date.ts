import { addMonths, monthRangeOf, todayStr } from '../../../shared/date'

export { addMonths, monthRangeOf, todayStr }

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/** '2026-08-23' -> '8月23日' */
export function formatDateCn(date: string): string {
  const [, m, d] = date.split('-').map(Number)
  return `${m}月${d}日`
}

/** '2026-08' -> '2026年8月' */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${y}年${m}月`
}

/** 今日中文标签，如 '2026年8月23日 星期天' */
export function todayLabelCn(date: Date = new Date()): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 星期${WEEKDAYS[date.getDay()]}`
}
