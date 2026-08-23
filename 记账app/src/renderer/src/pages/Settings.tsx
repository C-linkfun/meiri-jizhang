import { useEffect, useState } from 'react'
import { api, unwrap } from '../api'
import { centsToYuan, yuanToCents } from '../utils/money'

function Settings(): React.JSX.Element {
  const [dbPath, setDbPath] = useState('')
  const [budget, setBudget] = useState<number | null>(null)
  const [budgetText, setBudgetText] = useState('')
  const [error, setError] = useState('')
  const [savedMsg, setSavedMsg] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void api.app.getDbPath().then(setDbPath)
    void api.settings.getBudget().then((cents) => {
      setBudget(cents)
      setBudgetText(cents !== null ? centsToYuan(cents) : '')
    })
  }, [])

  const handleSave = async (): Promise<void> => {
    setError('')
    setSavedMsg('')
    const cents = yuanToCents(budgetText)
    if (cents === null) {
      setError('请输入正确的预算金额（大于 0，最多两位小数）')
      return
    }
    setSaving(true)
    try {
      unwrap(await api.settings.setBudget(cents))
      setBudget(cents)
      setBudgetText(centsToYuan(cents))
      setSavedMsg('预算已保存，本月支出接近或超出时会提醒您')
      window.setTimeout(() => setSavedMsg(''), 4000)
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async (): Promise<void> => {
    setError('')
    setSavedMsg('')
    setSaving(true)
    try {
      unwrap(await api.settings.setBudget(null))
      setBudget(null)
      setBudgetText('')
      setSavedMsg('已清除预算，不再提醒')
      window.setTimeout(() => setSavedMsg(''), 4000)
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <h2 className="page-title">设置</h2>

      <div className="setting-block">
        <div className="setting-label">月度预算与提醒</div>
        <p className="setting-desc">
          设置每月支出预算上限。本月支出达到预算的 80%
          时提醒您注意，超出预算时再次提醒；清除预算后不再提醒。
        </p>
        <div className="budget-form">
          <div className="budget-input-wrap">
            <input
              className="budget-input"
              type="text"
              inputMode="decimal"
              placeholder="例如 3000"
              value={budgetText}
              onChange={(e) => setBudgetText(e.target.value)}
            />
            <span className="amount-unit">元/月</span>
          </div>
          <button className="btn-primary" disabled={saving} onClick={() => void handleSave()}>
            {saving ? '保存中…' : '保存'}
          </button>
          {budget !== null && (
            <button className="btn-secondary" disabled={saving} onClick={() => void handleClear()}>
              清除预算
            </button>
          )}
        </div>
        {error && <div className="form-error">{error}</div>}
        {savedMsg && <div className="form-success">{savedMsg}</div>}
      </div>

      <div className="setting-block">
        <div className="setting-label">账单数据文件</div>
        <p className="setting-desc">
          您记的每一笔账都保存在下面这个文件里。重装系统或换电脑前，请先把整个文件夹复制到 U
          盘或网盘备份。
        </p>
        <div className="db-path-box">{dbPath || '读取中…'}</div>
      </div>
    </div>
  )
}

export default Settings
