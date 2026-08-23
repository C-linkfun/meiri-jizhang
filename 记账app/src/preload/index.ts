import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IPC_CHANNELS, type Api } from '../shared/types'

// 渲染进程可用的业务接口：记录、分类、应用信息
const api: Api = {
  records: {
    listByDay: (date) => ipcRenderer.invoke(IPC_CHANNELS.recordsListByDay, date),
    listByMonth: (month) => ipcRenderer.invoke(IPC_CHANNELS.recordsListByMonth, month),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.recordsCreate, input),
    update: (id, input) => ipcRenderer.invoke(IPC_CHANNELS.recordsUpdate, id, input),
    remove: (id) => ipcRenderer.invoke(IPC_CHANNELS.recordsDelete, id),
    getDailySummary: (date) => ipcRenderer.invoke(IPC_CHANNELS.recordsDailySummary, date),
    getMonthlySummary: (month) => ipcRenderer.invoke(IPC_CHANNELS.recordsMonthlySummary, month),
    getMonthCategoryStats: (month) =>
      ipcRenderer.invoke(IPC_CHANNELS.recordsMonthCategoryStats, month),
    getMonthlyTrend: (endMonth, count) =>
      ipcRenderer.invoke(IPC_CHANNELS.recordsMonthlyTrend, endMonth, count)
  },
  categories: {
    listTree: () => ipcRenderer.invoke(IPC_CHANNELS.categoriesListTree),
    create: (input) => ipcRenderer.invoke(IPC_CHANNELS.categoriesCreate, input),
    rename: (id, name) => ipcRenderer.invoke(IPC_CHANNELS.categoriesRename, id, name),
    remove: (id) => ipcRenderer.invoke(IPC_CHANNELS.categoriesDelete, id),
    move: (id, direction) => ipcRenderer.invoke(IPC_CHANNELS.categoriesMove, id, direction)
  },
  app: {
    getDbPath: () => ipcRenderer.invoke(IPC_CHANNELS.appGetDbPath)
  },
  settings: {
    getBudget: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGetBudget),
    setBudget: (cents) => ipcRenderer.invoke(IPC_CHANNELS.settingsSetBudget, cents)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
