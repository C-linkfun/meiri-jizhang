import { ipcMain } from 'electron'
import { IPC_CHANNELS, type ApiResult, type Category, type RecordType } from '../shared/types'
import { getDb } from './db'
import type { DatabaseSync } from 'node:sqlite'

const CATEGORY_NAME_MAX = 20

type Row = Record<string, unknown>

function rowToCategory(row: Row): Category {
  return {
    id: row.id as number,
    type: row.type as RecordType,
    parentId: row.parent_id as number | null,
    name: row.name as string,
    sortOrder: row.sort_order as number
  }
}

/** 分类名校验，返回 trim 后的名称；不合法返回 null */
function validateName(name: unknown): string | null {
  if (typeof name !== 'string') return null
  const trimmed = name.trim()
  if (trimmed === '') return null
  if (trimmed.length > CATEGORY_NAME_MAX) return null
  return trimmed
}

/** 同类型同层级是否已存在同名分类（excludeId 用于改名时排除自己） */
function hasSameName(
  db: DatabaseSync,
  type: string,
  parentId: number | null,
  name: string,
  excludeId: number
): boolean {
  const sql =
    parentId === null
      ? 'SELECT id FROM categories WHERE type = ? AND parent_id IS NULL AND name = ? AND id != ?'
      : 'SELECT id FROM categories WHERE type = ? AND parent_id = ? AND name = ? AND id != ?'
  const params = parentId === null ? [type, name, excludeId] : [type, parentId, name, excludeId]
  return db.prepare(sql).get(...params) !== undefined
}

function getCategory(db: DatabaseSync, id: number): Row | undefined {
  return db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as unknown as Row | undefined
}

export function registerCategoryHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.categoriesListTree, (): Category[] => {
    const rows = getDb()
      .prepare('SELECT * FROM categories ORDER BY type, sort_order, id')
      .all() as unknown as Row[]
    return rows.map(rowToCategory)
  })

  ipcMain.handle(IPC_CHANNELS.categoriesCreate, (_e, input: unknown): ApiResult<Category> => {
    if (typeof input !== 'object' || input === null) return { ok: false, message: '数据格式不正确' }
    const v = input as Record<string, unknown>
    if (v.type !== 'expense' && v.type !== 'income') return { ok: false, message: '收支类型不正确' }
    const name = validateName(v.name)
    if (name === null) return { ok: false, message: `分类名称需为 1-${CATEGORY_NAME_MAX} 个字` }
    let parentId: number | null = null
    if (v.parentId !== null && v.parentId !== undefined) {
      if (!Number.isInteger(v.parentId) || (v.parentId as number) <= 0)
        return { ok: false, message: '上级分类不正确' }
      parentId = v.parentId as number
    }

    const db = getDb()
    if (parentId !== null) {
      const parent = getCategory(db, parentId)
      if (!parent || parent.parent_id !== null || parent.type !== v.type)
        return { ok: false, message: '上级分类不存在' }
    }
    if (hasSameName(db, v.type as string, parentId, name, -1))
      return { ok: false, message: '该分类已存在' }

    const maxRow = (
      parentId === null
        ? db
            .prepare(
              'SELECT COALESCE(MAX(sort_order), 0) AS m FROM categories WHERE type = ? AND parent_id IS NULL'
            )
            .get(v.type as string)
        : db
            .prepare(
              'SELECT COALESCE(MAX(sort_order), 0) AS m FROM categories WHERE type = ? AND parent_id = ?'
            )
            .get(v.type as string, parentId)
    ) as { m: number }

    const info = db
      .prepare('INSERT INTO categories (type, parent_id, name, sort_order) VALUES (?, ?, ?, ?)')
      .run(v.type as string, parentId, name, maxRow.m + 10)
    const row = getCategory(db, Number(info.lastInsertRowid))
    return { ok: true, data: rowToCategory(row as Row) }
  })

  ipcMain.handle(
    IPC_CHANNELS.categoriesRename,
    (_e, id: unknown, name: unknown): ApiResult<Category> => {
      if (!Number.isInteger(id) || (id as number) <= 0)
        return { ok: false, message: '分类编号不正确' }
      const db = getDb()
      const cat = getCategory(db, id as number)
      if (!cat) return { ok: false, message: '该分类不存在' }
      const trimmed = validateName(name)
      if (trimmed === null)
        return { ok: false, message: `分类名称需为 1-${CATEGORY_NAME_MAX} 个字` }
      if (trimmed === cat.name) return { ok: true, data: rowToCategory(cat) }
      if (
        hasSameName(db, cat.type as string, cat.parent_id as number | null, trimmed, id as number)
      )
        return { ok: false, message: '该分类已存在' }

      try {
        db.prepare(
          "UPDATE categories SET name = ?, updated_at = datetime('now', 'localtime') WHERE id = ?"
        ).run(trimmed, id as number)
      } catch (e) {
        // 唯一索引兜底
        if (String(e).includes('UNIQUE')) return { ok: false, message: '该分类已存在' }
        throw e
      }
      const row = getCategory(db, id as number)
      return { ok: true, data: rowToCategory(row as Row) }
    }
  )

  ipcMain.handle(IPC_CHANNELS.categoriesDelete, (_e, id: unknown): ApiResult<null> => {
    if (!Number.isInteger(id) || (id as number) <= 0)
      return { ok: false, message: '分类编号不正确' }
    const db = getDb()
    const cat = getCategory(db, id as number)
    if (!cat) return { ok: false, message: '该分类不存在' }

    // 只删分类，不碰历史账单（账单里存的是名称快照）
    db.exec('BEGIN IMMEDIATE')
    try {
      if (cat.parent_id === null) {
        db.prepare('DELETE FROM categories WHERE parent_id = ?').run(id as number)
      }
      db.prepare('DELETE FROM categories WHERE id = ?').run(id as number)
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
    return { ok: true }
  })

  ipcMain.handle(
    IPC_CHANNELS.categoriesMove,
    (_e, id: unknown, direction: unknown): ApiResult<null> => {
      if (!Number.isInteger(id) || (id as number) <= 0)
        return { ok: false, message: '分类编号不正确' }
      if (direction !== 'up' && direction !== 'down')
        return { ok: false, message: '移动方向不正确' }
      const db = getDb()
      const cat = getCategory(db, id as number)
      if (!cat) return { ok: false, message: '该分类不存在' }

      // 取同层兄弟（同类型、同父级），按 sort_order 排序后交换相邻两项
      const siblings = (cat.parent_id === null
        ? db
            .prepare(
              'SELECT * FROM categories WHERE type = ? AND parent_id IS NULL ORDER BY sort_order, id'
            )
            .all(cat.type as string)
        : db
            .prepare(
              'SELECT * FROM categories WHERE type = ? AND parent_id = ? ORDER BY sort_order, id'
            )
            .all(cat.type as string, cat.parent_id as number)) as unknown as Row[]

      const idx = siblings.findIndex((s) => s.id === id)
      const target = direction === 'up' ? idx - 1 : idx + 1
      if (target < 0 || target >= siblings.length) return { ok: true } // 已在首/末位

      const a = siblings[idx]
      const b = siblings[target]
      db.exec('BEGIN IMMEDIATE')
      try {
        db.prepare(
          "UPDATE categories SET sort_order = ?, updated_at = datetime('now', 'localtime') WHERE id = ?"
        ).run(b.sort_order as number, a.id as number)
        db.prepare(
          "UPDATE categories SET sort_order = ?, updated_at = datetime('now', 'localtime') WHERE id = ?"
        ).run(a.sort_order as number, b.id as number)
        db.exec('COMMIT')
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
      return { ok: true }
    }
  )
}
