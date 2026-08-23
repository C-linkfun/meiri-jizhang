import { DatabaseSync } from 'node:sqlite'
import { join } from 'path'
import { app } from 'electron'

// 数据库单例：主进程独占访问，渲染进程一律走 IPC
let db: DatabaseSync | null = null

export function getDb(): DatabaseSync {
  if (!db) throw new Error('数据库尚未初始化，请先调用 initDatabase()')
  return db
}

/** 数据库文件：%APPDATA%\meiri-jizhang\meiri-jizhang.db（设置页向用户展示此路径） */
export function getDbPath(): string {
  return join(app.getPath('userData'), 'meiri-jizhang.db')
}

/** 打开数据库并建表。必须在 app.whenReady() 之后、createWindow() 之前调用 */
export function initDatabase(): void {
  db = new DatabaseSync(getDbPath())
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA user_version = 1;

    -- 分类表：两级结构，parent_id 为空表示大科目
    CREATE TABLE IF NOT EXISTS categories (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      type        TEXT    NOT NULL CHECK (type IN ('expense', 'income')),
      parent_id   INTEGER REFERENCES categories(id) ON DELETE CASCADE,
      name        TEXT    NOT NULL,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    -- 同类型同层级下禁止重名（COALESCE 处理 NULL 互不相等的问题）
    CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_name
      ON categories (type, COALESCE(parent_id, 0), name);

    CREATE INDEX IF NOT EXISTS idx_categories_tree
      ON categories (type, parent_id, sort_order);

    -- 账单表：分类直接存名称（v1 简化方案，删分类不影响历史账单）
    CREATE TABLE IF NOT EXISTS records (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      type        TEXT    NOT NULL CHECK (type IN ('expense', 'income')),
      amount      INTEGER NOT NULL CHECK (amount > 0),   -- 单位：分
      category    TEXT    NOT NULL,                      -- 大科目名称
      subcategory TEXT    NOT NULL,                      -- 子类名称
      date        TEXT    NOT NULL,                      -- YYYY-MM-DD
      note        TEXT    NOT NULL DEFAULT '',
      created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE INDEX IF NOT EXISTS idx_records_date ON records (date);
    CREATE INDEX IF NOT EXISTS idx_records_type_date ON records (type, date);

    -- 应用设置（键值对）：目前用于存储月度预算
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
}
