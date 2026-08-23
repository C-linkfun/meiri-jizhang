import { ipcMain } from 'electron'
import { IPC_CHANNELS, type ApiResult } from '../shared/types'
import { getDb } from './db'

const BUDGET_KEY = 'monthly_budget'
/** 预算上限：999,999,999.99 元（分） */
const MAX_BUDGET_CENTS = 99999999999

export function registerSettingsHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.settingsGetBudget, (): number | null => {
    const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(BUDGET_KEY) as
      { value: string } | undefined
    if (!row) return null
    const cents = Number(row.value)
    return Number.isSafeInteger(cents) && cents > 0 ? cents : null
  })

  ipcMain.handle(IPC_CHANNELS.settingsSetBudget, (_e, cents: unknown): ApiResult<null> => {
    if (cents === null) {
      getDb().prepare('DELETE FROM settings WHERE key = ?').run(BUDGET_KEY)
      return { ok: true }
    }
    if (
      !Number.isSafeInteger(cents) ||
      (cents as number) <= 0 ||
      (cents as number) > MAX_BUDGET_CENTS
    )
      return { ok: false, message: '预算金额不正确，必须大于 0' }
    getDb()
      .prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      )
      .run(BUDGET_KEY, String(cents as number))
    return { ok: true }
  })
}
