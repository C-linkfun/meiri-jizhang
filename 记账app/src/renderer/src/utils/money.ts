// 金额工具：内部一律以「分」整数运算，显示时转元

/** 元字符串（如 "28.5"、"28.50"）转分；不合法返回 null。用字符串运算避免浮点误差 */
export function yuanToCents(input: string): number | null {
  const s = input.trim()
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(s)) return null
  const [intPart, decPart = ''] = s.split('.')
  const cents = Number(intPart) * 100 + Number(decPart.padEnd(2, '0'))
  if (!Number.isSafeInteger(cents) || cents <= 0) return null
  return cents
}

/** 分转元字符串（保留两位小数），如 2850 -> "28.50" */
export function centsToYuan(cents: number): string {
  return (cents / 100).toFixed(2)
}

/** 格式化金额：type 为支出显示 -¥28.50（红），收入显示 +¥5,000.00（绿） */
export function formatMoney(cents: number, type?: 'expense' | 'income'): string {
  const yuan = centsToYuan(cents)
  if (type === 'expense') return `-¥${yuan}`
  if (type === 'income') return `+¥${yuan}`
  return `¥ ${yuan}`
}
