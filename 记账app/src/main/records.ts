import { ipcMain } from 'electron'
import {
  IPC_CHANNELS,
  type ApiResult,
  type CategoryStat,
  type DailySummary,
  type DayGroup,
  type MonthCategoryStats,
  type MonthlySummary,
  type RecordInput,
  type RecordItem,
  type TrendPoint
} from '../shared/types'
import { addMonths, isValidDateStr, monthRangeOf, todayStr } from '../shared/date'
import { getDb } from './db'

/** 金额上限：999,999,999.99 元（分），防溢出 */
const MAX_AMOUNT_CENTS = 99999999999

type Row = Record<string, unknown>

function rowToRecord(row: Row): RecordItem {
  return {
    id: row.id as number,
    type: row.type as RecordItem['type'],
    amount: row.amount as number,
    category: row.category as string,
    subcategory: row.subcategory as string,
    date: row.date as string,
    note: row.note as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  }
}

/** 主进程侧输入校验（不信任渲染端） */
function validateRecordInput(
  input: unknown
): { ok: true; value: RecordInput } | { ok: false; message: string } {
  if (typeof input !== 'object' || input === null) return { ok: false, message: '数据格式不正确' }
  const v = input as Record<string, unknown>
  if (v.type !== 'expense' && v.type !== 'income') return { ok: false, message: '收支类型不正确' }
  if (
    !Number.isSafeInteger(v.amount) ||
    (v.amount as number) <= 0 ||
    (v.amount as number) > MAX_AMOUNT_CENTS
  )
    return { ok: false, message: '金额不正确，必须大于 0' }
  if (typeof v.date !== 'string' || !isValidDateStr(v.date))
    return { ok: false, message: '日期格式不正确' }
  if (typeof v.category !== 'string' || v.category.trim() === '')
    return { ok: false, message: '请选择大科目' }
  if (typeof v.subcategory !== 'string' || v.subcategory.trim() === '')
    return { ok: false, message: '请选择子类' }
  const note = typeof v.note === 'string' ? v.note : ''
  if (note.trim().length > 100) return { ok: false, message: '备注不能超过 100 个字' }
  return {
    ok: true,
    value: {
      type: v.type as RecordInput['type'],
      amount: v.amount as number,
      category: v.category.trim(),
      subcategory: v.subcategory.trim(),
      date: v.date,
      note: note.trim()
    }
  }
}

export function registerRecordHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.recordsListByDay, (_e, date: unknown): RecordItem[] => {
    if (typeof date !== 'string' || !isValidDateStr(date)) return []
    const rows = getDb()
      .prepare('SELECT * FROM records WHERE date = ? ORDER BY id DESC')
      .all(date) as unknown as Row[]
    return rows.map(rowToRecord)
  })

  ipcMain.handle(IPC_CHANNELS.recordsListByMonth, (_e, month: unknown): DayGroup[] => {
    if (typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) return []
    const [start, end] = monthRangeOf(month)
    const rows = getDb()
      .prepare('SELECT * FROM records WHERE date >= ? AND date <= ? ORDER BY date DESC, id DESC')
      .all(start, end) as unknown as Row[]
    const groups = new Map<string, DayGroup>()
    for (const row of rows) {
      const rec = rowToRecord(row)
      let group = groups.get(rec.date)
      if (!group) {
        group = { date: rec.date, income: 0, expense: 0, records: [] }
        groups.set(rec.date, group)
      }
      if (rec.type === 'income') group.income += rec.amount
      else group.expense += rec.amount
      group.records.push(rec)
    }
    // 行已按日期倒序查询，Map 插入顺序即日期倒序
    return [...groups.values()]
  })

  ipcMain.handle(IPC_CHANNELS.recordsCreate, (_e, input: unknown): ApiResult<RecordItem> => {
    const check = validateRecordInput(input)
    if (!check.ok) return { ok: false, message: check.message }
    const v = check.value
    const info = getDb()
      .prepare(
        'INSERT INTO records (type, amount, category, subcategory, date, note) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(v.type, v.amount, v.category, v.subcategory, v.date, v.note)
    const row = getDb()
      .prepare('SELECT * FROM records WHERE id = ?')
      .get(info.lastInsertRowid) as unknown as Row
    return { ok: true, data: rowToRecord(row) }
  })

  ipcMain.handle(
    IPC_CHANNELS.recordsUpdate,
    (_e, id: unknown, input: unknown): ApiResult<RecordItem> => {
      if (!Number.isInteger(id) || (id as number) <= 0)
        return { ok: false, message: '账单编号不正确' }
      const check = validateRecordInput(input)
      if (!check.ok) return { ok: false, message: check.message }
      const v = check.value
      const info = getDb()
        .prepare(
          `UPDATE records SET type = ?, amount = ?, category = ?, subcategory = ?, date = ?, note = ?,
         updated_at = datetime('now', 'localtime') WHERE id = ?`
        )
        .run(v.type, v.amount, v.category, v.subcategory, v.date, v.note, id as number)
      if (info.changes === 0) return { ok: false, message: '该账单不存在或已被删除' }
      const row = getDb()
        .prepare('SELECT * FROM records WHERE id = ?')
        .get(id as number) as unknown as Row
      return { ok: true, data: rowToRecord(row) }
    }
  )

  ipcMain.handle(IPC_CHANNELS.recordsDelete, (_e, id: unknown): ApiResult<null> => {
    if (!Number.isInteger(id) || (id as number) <= 0)
      return { ok: false, message: '账单编号不正确' }
    const info = getDb()
      .prepare('DELETE FROM records WHERE id = ?')
      .run(id as number)
    if (info.changes === 0) return { ok: false, message: '该账单不存在或已被删除' }
    return { ok: true }
  })

  ipcMain.handle(IPC_CHANNELS.recordsDailySummary, (_e, date: unknown): DailySummary => {
    const safe = typeof date === 'string' && isValidDateStr(date) ? date : todayStr()
    const rows = getDb()
      .prepare(
        'SELECT type, SUM(amount) AS total, COUNT(*) AS count FROM records WHERE date = ? GROUP BY type'
      )
      .all(safe) as unknown as { type: string; total: number; count: number }[]
    let income = 0
    let expense = 0
    let count = 0
    for (const r of rows) {
      if (r.type === 'income') income = r.total
      else expense = r.total
      count += r.count
    }
    return { date: safe, income, expense, balance: income - expense, count }
  })

  ipcMain.handle(IPC_CHANNELS.recordsMonthlySummary, (_e, month: unknown): MonthlySummary => {
    const safe =
      typeof month === 'string' && /^\d{4}-\d{2}$/.test(month) ? month : todayStr().slice(0, 7)
    const [start, end] = monthRangeOf(safe)
    const rows = getDb()
      .prepare(
        'SELECT type, SUM(amount) AS total, COUNT(*) AS count FROM records WHERE date >= ? AND date <= ? GROUP BY type'
      )
      .all(start, end) as unknown as { type: string; total: number; count: number }[]
    let income = 0
    let expense = 0
    let count = 0
    for (const r of rows) {
      if (r.type === 'income') income = r.total
      else expense = r.total
      count += r.count
    }
    return { month: safe, income, expense, balance: income - expense, count }
  })

  ipcMain.handle(
    IPC_CHANNELS.recordsMonthCategoryStats,
    (_e, month: unknown): MonthCategoryStats => {
      const safe =
        typeof month === 'string' && /^\d{4}-\d{2}$/.test(month) ? month : todayStr().slice(0, 7)
      const [start, end] = monthRangeOf(safe)
      const rows = getDb()
        .prepare(
          'SELECT type, category, SUM(amount) AS total, COUNT(*) AS count FROM records WHERE date >= ? AND date <= ? GROUP BY type, category ORDER BY total DESC'
        )
        .all(start, end) as unknown as {
        type: string
        category: string
        total: number
        count: number
      }[]
      const expense: CategoryStat[] = []
      const income: CategoryStat[] = []
      for (const r of rows) {
        const item = { name: r.category, amount: r.total, count: r.count }
        if (r.type === 'income') income.push(item)
        else expense.push(item)
      }
      return { month: safe, expense, income }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.recordsMonthlyTrend,
    (_e, endMonth: unknown, countArg: unknown): TrendPoint[] => {
      const safe =
        typeof endMonth === 'string' && /^\d{4}-\d{2}$/.test(endMonth)
          ? endMonth
          : todayStr().slice(0, 7)
      const count =
        Number.isInteger(countArg) && (countArg as number) >= 2 && (countArg as number) <= 24
          ? (countArg as number)
          : 12
      const months: string[] = []
      for (let i = count - 1; i >= 0; i--) months.push(addMonths(safe, -i))
      const start = `${months[0]}-01`
      const end = monthRangeOf(safe)[1]
      const rows = getDb()
        .prepare(
          'SELECT substr(date, 1, 7) AS month, type, SUM(amount) AS total FROM records WHERE date >= ? AND date <= ? GROUP BY month, type'
        )
        .all(start, end) as unknown as { month: string; type: string; total: number }[]
      const byMonth = new Map<string, TrendPoint>(
        months.map((m) => [m, { month: m, income: 0, expense: 0 }])
      )
      for (const r of rows) {
        const point = byMonth.get(r.month)
        if (!point) continue
        if (r.type === 'income') point.income = r.total
        else point.expense = r.total
      }
      return months.map((m) => byMonth.get(m) as TrendPoint)
    }
  )
}
