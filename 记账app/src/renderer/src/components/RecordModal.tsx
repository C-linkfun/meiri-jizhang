import { useEffect, useState } from 'react'
import { api, unwrap } from '../api'
import { centsToYuan, yuanToCents } from '../utils/money'
import { todayStr } from '../utils/date'
import Modal from './Modal'
import type { Category, RecordItem, RecordType } from '../../../shared/types'

interface RecordModalProps {
  open: boolean
  /** null 表示新增 */
  record: RecordItem | null
  defaultType?: RecordType
  onClose: () => void
  onSaved: (record: RecordItem) => void
}

/** 记一笔 / 编辑账单共用的弹窗 */
function RecordModal({
  open,
  record,
  defaultType = 'expense',
  onClose,
  onSaved
}: RecordModalProps): React.JSX.Element {
  const [categories, setCategories] = useState<Category[]>([])
  const [type, setType] = useState<RecordType>(defaultType)
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [amountText, setAmountText] = useState('')
  const [date, setDate] = useState(todayStr())
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // 弹窗每次打开时重置表单（渲染期重置，避免在 effect 里同步 setState）
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setError('')
      setSaving(false)
      if (record) {
        setType(record.type)
        setCategory(record.category)
        setSubcategory(record.subcategory)
        setAmountText(centsToYuan(record.amount))
        setDate(record.date)
        setNote(record.note)
      } else {
        setType(defaultType)
        setCategory('')
        setSubcategory('')
        setAmountText('')
        setDate(todayStr())
        setNote('')
      }
    }
  }

  // 每次打开时拉取最新分类
  useEffect(() => {
    if (!open) return
    void api.categories
      .listTree()
      .then(setCategories)
      .catch(() => setError('分类加载失败，请重试'))
  }, [open])

  const majors = categories.filter((c) => c.type === type && c.parentId === null)
  const major = majors.find((m) => m.name === category)
  const subs = major ? categories.filter((c) => c.parentId === major.id) : []
  // 编辑历史账单时，原分类可能已被删除：强制用户重选
  const majorExists = category !== '' && major !== undefined
  const subExists = subcategory !== '' && subs.some((s) => s.name === subcategory)

  const switchType = (t: RecordType): void => {
    setType(t)
    setCategory('')
    setSubcategory('')
  }

  const handleSave = async (): Promise<void> => {
    const amount = yuanToCents(amountText)
    if (amount === null) {
      setError('请输入正确金额（大于 0，最多两位小数）')
      return
    }
    if (!majorExists) {
      setError('请选择大科目')
      return
    }
    if (!subExists) {
      setError('请选择子类')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('请选择日期')
      return
    }
    setError('')
    setSaving(true)
    try {
      const input = { type, amount, category, subcategory, date, note }
      const saved = record
        ? unwrap(await api.records.update(record.id, input))
        : unwrap(await api.records.create(input))
      onSaved(saved)
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败，请重试')
      setSaving(false)
    }
  }

  return (
    <Modal open={open} title={record ? '编辑账单' : '记一笔'} onClose={onClose}>
      <form
        className="record-form"
        onSubmit={(e) => {
          e.preventDefault()
          void handleSave()
        }}
      >
        {error && <div className="form-error">{error}</div>}

        <div className="type-switch">
          <button
            type="button"
            className={`type-btn expense${type === 'expense' ? ' active' : ''}`}
            onClick={() => switchType('expense')}
          >
            支出
          </button>
          <button
            type="button"
            className={`type-btn income${type === 'income' ? ' active' : ''}`}
            onClick={() => switchType('income')}
          >
            收入
          </button>
        </div>

        <div className="form-row">
          <label>金额</label>
          <input
            className="amount-input"
            type="text"
            inputMode="decimal"
            placeholder="例如 28.50"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            autoFocus
          />
          <span className="amount-unit">元</span>
        </div>

        <div className="form-row">
          <label>分类</label>
          <div className="form-selects">
            <select
              value={majorExists ? category : ''}
              onChange={(e) => {
                setCategory(e.target.value)
                setSubcategory('')
              }}
            >
              <option value="" disabled>
                {category !== '' && !majorExists ? '原分类已删除，请重新选择' : '请选择大科目'}
              </option>
              {majors.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
            <select
              value={subExists ? subcategory : ''}
              disabled={!majorExists}
              onChange={(e) => setSubcategory(e.target.value)}
            >
              <option value="" disabled>
                {subcategory !== '' && !subExists
                  ? '原分类已删除，请重新选择'
                  : majorExists
                    ? '请选择子类'
                    : '请先选择大科目'}
              </option>
              {subs.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <label>日期</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="form-row">
          <label>备注（选填）</label>
          <textarea
            maxLength={100}
            placeholder="例如 午饭外卖"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <span className="note-count">{note.length}/100</span>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onClose}>
            取消
          </button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? '保存中…' : record ? '保存修改' : '保存'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default RecordModal
