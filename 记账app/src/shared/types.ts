// 主进程 / preload / 渲染进程三端共享的类型与 IPC 通道名

export type RecordType = 'expense' | 'income'

export interface Category {
  id: number
  type: RecordType
  /** null 表示大科目，非空表示其子类 */
  parentId: number | null
  name: string
  sortOrder: number
}

export interface RecordItem {
  id: number
  type: RecordType
  /** 金额，单位：分（28.50 元 = 2850） */
  amount: number
  category: string
  subcategory: string
  /** YYYY-MM-DD */
  date: string
  note: string
  createdAt: string
  updatedAt: string
}

/** 新增 / 编辑账单共用的输入 */
export interface RecordInput {
  type: RecordType
  amount: number
  category: string
  subcategory: string
  date: string
  note: string
}

export interface DailySummary {
  date: string
  income: number
  expense: number
  balance: number
  count: number
}

export interface MonthlySummary {
  month: string
  income: number
  expense: number
  balance: number
  count: number
}

/** 按月查询返回的按天分组 */
export interface DayGroup {
  date: string
  income: number
  expense: number
  records: RecordItem[]
}

/** 某月按大科目汇总的一项 */
export interface CategoryStat {
  name: string
  amount: number
  count: number
}

export interface MonthCategoryStats {
  month: string
  expense: CategoryStat[]
  income: CategoryStat[]
}

/** 月度收支趋势中的一个点 */
export interface TrendPoint {
  month: string
  income: number
  expense: number
}

/** 写操作统一返回：失败时带中文提示 */
export type ApiResult<T = null> = { ok: true; data?: T } | { ok: false; message: string }

export interface Api {
  records: {
    listByDay(date: string): Promise<RecordItem[]>
    listByMonth(month: string): Promise<DayGroup[]>
    create(input: RecordInput): Promise<ApiResult<RecordItem>>
    update(id: number, input: RecordInput): Promise<ApiResult<RecordItem>>
    remove(id: number): Promise<ApiResult<null>>
    getDailySummary(date: string): Promise<DailySummary>
    getMonthlySummary(month: string): Promise<MonthlySummary>
    getMonthCategoryStats(month: string): Promise<MonthCategoryStats>
    getMonthlyTrend(endMonth: string, count: number): Promise<TrendPoint[]>
  }
  categories: {
    listTree(): Promise<Category[]>
    create(input: {
      type: RecordType
      name: string
      parentId: number | null
    }): Promise<ApiResult<Category>>
    rename(id: number, name: string): Promise<ApiResult<Category>>
    remove(id: number): Promise<ApiResult<null>>
    move(id: number, direction: 'up' | 'down'): Promise<ApiResult<null>>
  }
  app: {
    getDbPath(): Promise<string>
  }
  settings: {
    /** 月度预算（分），未设置返回 null */
    getBudget(): Promise<number | null>
    /** 设置月度预算（分）；传 null 清除 */
    setBudget(cents: number | null): Promise<ApiResult<null>>
  }
}

export const IPC_CHANNELS = {
  recordsListByDay: 'records:listByDay',
  recordsListByMonth: 'records:listByMonth',
  recordsCreate: 'records:create',
  recordsUpdate: 'records:update',
  recordsDelete: 'records:delete',
  recordsDailySummary: 'records:getDailySummary',
  recordsMonthlySummary: 'records:getMonthlySummary',
  recordsMonthCategoryStats: 'records:getMonthCategoryStats',
  recordsMonthlyTrend: 'records:getMonthlyTrend',
  categoriesListTree: 'categories:listTree',
  categoriesCreate: 'categories:create',
  categoriesRename: 'categories:rename',
  categoriesDelete: 'categories:delete',
  categoriesMove: 'categories:move',
  appGetDbPath: 'app:getDbPath',
  settingsGetBudget: 'settings:getBudget',
  settingsSetBudget: 'settings:setBudget'
} as const
