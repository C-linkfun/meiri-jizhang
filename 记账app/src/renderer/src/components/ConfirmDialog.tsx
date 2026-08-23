import Modal from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmText?: string
  danger?: boolean
  onCancel: () => void
  onConfirm: () => void
}

/** 二次确认弹窗：所有删除操作统一走这里 */
function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确定删除',
  danger = true,
  onCancel,
  onConfirm
}: ConfirmDialogProps): React.JSX.Element {
  return (
    <Modal open={open} title={title} onClose={onCancel} width={420}>
      <p className="confirm-message">{message}</p>
      <div className="form-actions">
        <button className="btn-secondary" onClick={onCancel}>
          取消
        </button>
        <button className={`btn-primary${danger ? ' btn-danger' : ''}`} onClick={onConfirm}>
          {confirmText}
        </button>
      </div>
    </Modal>
  )
}

export default ConfirmDialog
