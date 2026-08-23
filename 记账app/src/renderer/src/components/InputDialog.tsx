import { useState } from 'react'
import Modal from './Modal'

interface InputDialogProps {
  open: boolean
  title: string
  placeholder?: string
  initialValue?: string
  maxLength?: number
  confirmText?: string
  onCancel: () => void
  /** 返回 Promise；抛错时错误信息显示在弹窗内并保持打开 */
  onConfirm: (value: string) => Promise<void> | void
}

/** 单行输入弹窗：新增大科目/子类、重命名共用 */
function InputDialog({
  open,
  title,
  placeholder = '请输入名称',
  initialValue = '',
  maxLength = 20,
  confirmText = '确定',
  onCancel,
  onConfirm
}: InputDialogProps): React.JSX.Element {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // 弹窗每次打开时重置（渲染期重置，避免在 effect 里同步 setState）
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) {
      setValue(initialValue)
      setError('')
      setBusy(false)
    }
  }

  const handleConfirm = async (): Promise<void> => {
    const v = value.trim()
    if (v === '') {
      setError('名称不能为空')
      return
    }
    setError('')
    setBusy(true)
    try {
      await onConfirm(v)
    } catch (e) {
      setError(e instanceof Error ? e.message : '操作失败，请重试')
      setBusy(false)
    }
  }

  return (
    <Modal open={open} title={title} onClose={onCancel} width={400}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void handleConfirm()
        }}
      >
        {error && <div className="form-error">{error}</div>}
        <div className="form-row">
          <input
            type="text"
            maxLength={maxLength}
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        </div>
        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            取消
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? '处理中…' : confirmText}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default InputDialog
