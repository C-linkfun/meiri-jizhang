import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { todayStr } from '../utils/date'
import { yuanToCents } from '../utils/money'
import BillList from '../components/BillList'
import MonthSwitcher from '../components/MonthSwitcher'
import RecordModal from '../components/RecordModal'
import ConfirmDialog from '../components/ConfirmDialog'
import type { Category, DayGroup, RecordItem } from '../../../shared/types'

interface Filters {
  type: '' | 'expense' | 'income'
  category: string
  keyword: string
  dateFrom: string
  dateTo: string
  amountMin: string
  amountMax: string
}

const EMPTY_FILTERS: Filters = {
  type: '',
  category: '',
  keyword: '',
  dateFrom: '',
  dateTo: '',
  amountMin: '',
  amountMax: ''
}

function Ledger(): React.JSX.Element {
  const [month, setMonth] = useState(todayStr().slice(0, 7))
  const [groups, setGroups] = useState<DayGroup[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<RecordItem | null>(null)
  const [deleting, setDeleting] = useState<RecordItem | null>(null)

  useEffect(() => {
    void api.records.listByMonth(month).then(setGroups)
  }, [month])

  useEffect(() => {
    void api.categories.listTree().then(setCategories)
  }, [])

  const reload = (): void => {
    void api.records.listByMonth(month).then(setGroups)
  }

  // 大科目选项跟随所选类型
  const majorNames = useMemo(() => {
    const majors = categories.filter(
      (c) => c.parentId === null && (filters.type === '' || c.type === filters.type)
    )
    return Array.from(new Set(majors.map((m) => m.name)))
  }, [categories, filters.type])

  const setFilter = (patch: Partial<Filters>): void => setFilters((f) => ({ ...f, ...patch }))

  // 在当月数据上按条件过滤（数据量小，渲染端过滤即可）；日小计随过滤结果重算
  const filteredGroups = useMemo(() => {
    const kw = filters.keyword.trim().toLowerCase()
    const minCents = filters.amountMin === '' ? null : yuanToCents(filters.amountMin)
    const maxCents = filters.amountMax === '' ? null : yuanToCents(filters.amountMax)
    return groups
      .map((g) => {
        const records = g.records.filter((r) => {
          if (filters.type !== '' && r.type !== filters.type) return false
          if (filters.category !== '' && r.category !== filters.category) return false
          if (kw !== '' && !`${r.note}${r.category}${r.subcategory}`.toLowerCase().includes(kw))
            return false
          if (filters.dateFrom !== '' && r.date < filters.dateFrom) return false
          if (filters.dateTo !== '' && r.date > filters.dateTo) return false
          if (minCents !== null && r.amount < minCents) return false
          if (maxCents !== null && r.amount > maxCents) return false
          return true
        })
        if (records.length === 0) return null
        const income = records.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0)
        const expense = records
          .filter((r) => r.type === 'expense')
          .reduce((s, r) => s + r.amount, 0)
        return { date: g.date, income, expense, records }
      })
      .filter((g): g is DayGroup => g !== null)
  }, [groups, filters])

  const hasFilter =
    filters.type !== '' ||
    filters.category !== '' ||
    filters.keyword.trim() !== '' ||
    filters.dateFrom !== '' ||
    filters.dateTo !== '' ||
    filters.amountMin !== '' ||
    filters.amountMax !== ''
  const resultCount = filteredGroups.reduce((s, g) => s + g.records.length, 0)

  const handleMonthChange = (m: string): void => {
    setMonth(m)
    // 日期范围作用于当前显示月份内，切换月份时清空
    setFilters((f) => ({ ...f, dateFrom: '', dateTo: '' }))
  }

  const handleDelete = async (): Promise<void> => {
    if (!deleting) return
    try {
      await api.records.remove(deleting.id)
      setDeleting(null)
      reload()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '删除失败，请重试')
    }
  }

  return (
    <div className="page">
      <h2 className="page-title">账单流水</h2>
      <MonthSwitcher month={month} onChange={handleMonthChange} />

      <div className="filter-bar">
        <div className="filter-row">
          <input
            className="filter-keyword"
            type="text"
            placeholder="搜索备注或分类…"
            value={filters.keyword}
            onChange={(e) => setFilter({ keyword: e.target.value })}
          />
          <select
            value={filters.type}
            onChange={(e) => setFilter({ type: e.target.value as Filters['type'], category: '' })}
          >
            <option value="">全部类型</option>
            <option value="expense">仅支出</option>
            <option value="income">仅收入</option>
          </select>
          <select
            value={filters.category}
            onChange={(e) => setFilter({ category: e.target.value })}
          >
            <option value="">全部分类</option>
            {majorNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-row">
          <span className="filter-label">日期</span>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => setFilter({ dateFrom: e.target.value })}
          />
          <span className="filter-label">至</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => setFilter({ dateTo: e.target.value })}
          />
          <span className="filter-label">金额</span>
          <input
            className="filter-amount"
            type="text"
            inputMode="decimal"
            placeholder="最小"
            value={filters.amountMin}
            onChange={(e) => setFilter({ amountMin: e.target.value })}
          />
          <span className="filter-label">—</span>
          <input
            className="filter-amount"
            type="text"
            inputMode="decimal"
            placeholder="最大"
            value={filters.amountMax}
            onChange={(e) => setFilter({ amountMax: e.target.value })}
          />
          {hasFilter && (
            <button
              className="btn-secondary filter-clear"
              onClick={() => setFilters(EMPTY_FILTERS)}
            >
              清除筛选
            </button>
          )}
        </div>
        {hasFilter && (
          <p className="filter-result">
            共找到 {resultCount} 笔
            {groups.length > 0 && resultCount === 0 ? '，试试调整筛选条件' : ''}
          </p>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="empty-state">本月还没有账单，去「今日记账」记下第一笔吧</div>
      ) : filteredGroups.length === 0 ? (
        <div className="empty-state">没有符合条件的账单，试试调整或清除筛选条件</div>
      ) : (
        <BillList
          groups={filteredGroups}
          onEdit={(record) => {
            setEditing(record)
            setModalOpen(true)
          }}
          onDelete={(record) => setDeleting(record)}
        />
      )}

      <RecordModal
        open={modalOpen}
        record={editing}
        onClose={() => {
          setModalOpen(false)
          setEditing(null)
        }}
        onSaved={() => {
          setModalOpen(false)
          setEditing(null)
          reload()
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="删除账单"
        message="确定删除这笔账单吗？删除后无法恢复。"
        onCancel={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}

export default Ledger
