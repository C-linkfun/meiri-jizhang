import type { Api, ApiResult } from '../../shared/types'

// window.api 由 preload 注入（类型声明见 src/preload/index.d.ts）
export const api: Api = window.api

/** 解包 ApiResult：失败时抛出带中文消息的 Error */
export function unwrap<T>(result: ApiResult<T>): T {
  if (result.ok) return result.data as T
  throw new Error(result.message)
}
