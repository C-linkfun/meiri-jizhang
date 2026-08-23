import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../shared/types'
import { getDbPath } from './db'
import { registerRecordHandlers } from './records'
import { registerCategoryHandlers } from './categories'
import { registerSettingsHandlers } from './settings'

/** 汇总注册全部 IPC handler，app.whenReady 内调用一次 */
export function registerIpcHandlers(): void {
  registerRecordHandlers()
  registerCategoryHandlers()
  registerSettingsHandlers()
  ipcMain.handle(IPC_CHANNELS.appGetDbPath, () => getDbPath())
}
