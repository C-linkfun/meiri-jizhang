import { useEffect, useState } from 'react'
import { api } from '../api'
import { centsToYuan, formatMoney } from '../utils/money'
import { todayLabelCn, todayStr } from '../utils/date'
import BillList from '../components/BillList'
import RecordModal from '../components/RecordModal'
import ConfirmDialog from '../components/ConfirmDialog'
import type { DailySummary, RecordItem } from '../../../shared/types'

function Home(): React.JSX.Element {
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [todayRecords, setTodayRecords] = useState<RecordItem[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<RecordItem | null>(null)
  const [deleting, setDeleting] = useState<RecordItem | null>(null)
  const [budget, setBudget] = useState<number | null>(null)
  const [monthExpense, setMonthExpense] = useState(0)

  const reload = (): void => {
    const date = todayStr()
    Promise.all([
      api.records.getDailySummary(date),
      api.records.listByDay(date),
      api.records.getMonthlySummary(date.slice(0, 7)),
      api.settings.getBudget()
    ])
      .then(([s, list, ms, b]) => {
        setSummary(s)
        setTodayRecords(list)
        setMonthExpense(ms.expense)
        setBudget(b)
      })
      .catch((e) => window.alert(e instanceof Error ? e.message : '数据加载失败，请重试'))
  }

  useEffect(() => {
    reload()
  }, [])

  const handleSaved = (): void => {
    setModalOpen(false)
    setEditing(null)
    void reload()
  }

  const handleDelete = async (): Promise<void> => {
    if (!deleting) return
    try {
      await api.records.remove(deleting.id)
      setDeleting(null)
      void reload()
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '删除失败，请重试')
    }
  }

  const income = summary?.income ?? 0
  const expense = summary?.expense ?? 0
  const balance = summary?.balance ?? 0
  // 预算提醒：达到 80% 黄色提醒，超出 100% 红色提醒
  const budgetPercent =
    budget !== null && budget > 0 ? Math.round((monthExpense / budget) * 100) : null
  const showBudgetAlert = budgetPercent !== null && budgetPercent >= 80

  return (
    <div className="page">
      <h2 className="page-title">今日记账</h2>
      <div className="today-line">今天 · {todayLabelCn()}</div>
      {showBudgetAlert && budget !== null && (
        <div className={`budget-alert${budgetPercent! >= 100 ? ' over' : ''}`}>
          <span className="budget-alert-icon">{budgetPercent! >= 100 ? '❗' : '⚠️'}</span>
          <span>
            {budgetPercent! >= 100
              ? `本月支出 ¥ ${centsToYuan(monthExpense)} 已超出预算 ¥ ${centsToYuan(budget)}，超出 ¥ ${centsToYuan(monthExpense - budget)}`
              : `本月支出已达预算的 ${budgetPercent}%（¥ ${centsToYuan(monthExpense)} / 预算 ¥ ${centsToYuan(budget)}）`}
          </span>
        </div>
      )}
      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-label">今日收入</div>
          <div className="summary-amount income">{formatMoney(income)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">今日支出</div>
          <div className="summary-amount expense">{formatMoney(expense)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">今日结余</div>
          <div className="summary-amount balance">{formatMoney(balance)}</div>
        </div>
      </div>
      <button className="add-button" onClick={() => setModalOpen(true)}>
        ＋ 记一笔
      </button>
      <div className="section-title">今日账单</div>
      {todayRecords.length === 0 ? (
        <div className="empty-state">今天还没有记账，点击上方「记一笔」记下第一笔吧</div>
      ) : (
        <BillList
          groups={[{ date: todayStr(), income, expense, records: todayRecords }]}
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
        onSaved={handleSaved}
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

export default Home
