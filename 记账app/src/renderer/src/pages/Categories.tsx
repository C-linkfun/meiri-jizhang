import { useEffect, useState } from 'react'
import { api, unwrap } from '../api'
import InputDialog from '../components/InputDialog'
import ConfirmDialog from '../components/ConfirmDialog'
import type { Category, RecordType } from '../../../shared/types'

type DialogState =
  | { kind: 'addMajor' }
  | { kind: 'addSub'; parent: Category }
  | { kind: 'rename'; target: Category }
  | null

function Categories(): React.JSX.Element {
  const [activeType, setActiveType] = useState<RecordType>('expense')
  const [cats, setCats] = useState<Category[]>([])
  const [error, setError] = useState('')
  const [dialog, setDialog] = useState<DialogState>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)

  const reload = (): void => {
    void api.categories.listTree().then(setCats)
  }

  useEffect(() => {
    reload()
  }, [])

  const majors = cats.filter((c) => c.type === activeType && c.parentId === null)
  const childrenOf = (id: number): Category[] => cats.filter((c) => c.parentId === id)

  const handleConfirm = async (name: string): Promise<void> => {
    if (!dialog) return
    setError('')
    try {
      if (dialog.kind === 'addMajor') {
        unwrap(await api.categories.create({ type: activeType, name, parentId: null }))
      } else if (dialog.kind === 'addSub') {
        unwrap(await api.categories.create({ type: activeType, name, parentId: dialog.parent.id }))
      } else {
        unwrap(await api.categories.rename(dialog.target.id, name))
      }
      setDialog(null)
      await reload()
    } catch (e) {
      throw new Error(e instanceof Error ? e.message : '操作失败，请重试')
    }
  }

  const handleDelete = async (): Promise<void> => {
    if (!deleting) return
    setError('')
    try {
      unwrap(await api.categories.remove(deleting.id))
      setDeleting(null)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败，请重试')
      setDeleting(null)
    }
  }

  const handleMove = async (id: number, direction: 'up' | 'down'): Promise<void> => {
    setError('')
    try {
      unwrap(await api.categories.move(id, direction))
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : '移动失败，请重试')
    }
  }

  return (
    <div className="page">
      <h2 className="page-title">分类管理</h2>
      <div className="tabs">
        <button
          className={`tab${activeType === 'expense' ? ' active' : ''}`}
          onClick={() => setActiveType('expense')}
        >
          支出
        </button>
        <button
          className={`tab${activeType === 'income' ? ' active' : ''}`}
          onClick={() => setActiveType('income')}
        >
          收入
        </button>
        <button
          className="tab"
          onClick={() => {
            setError('')
            setDialog({ kind: 'addMajor' })
          }}
        >
          ＋ 新增大科目
        </button>
      </div>
      <p className="page-hint">
        提示：改名或删除分类不会影响已记录的账单，账单仍保留原来的分类名称。
      </p>
      {error && <div className="form-error">{error}</div>}

      <div className="cat-list">
        {majors.map((major, mi) => {
          const subs = childrenOf(major.id)
          return (
            <div key={major.id}>
              <div className="cat-row major">
                <span className="cat-name">
                  {major.name}
                  <span className="cat-count">（{subs.length} 个子类）</span>
                </span>
                <span className="cat-actions">
                  <button
                    onClick={() => {
                      setError('')
                      setDialog({ kind: 'addSub', parent: major })
                    }}
                  >
                    ＋ 子类
                  </button>
                  <button
                    onClick={() => {
                      setError('')
                      setDialog({ kind: 'rename', target: major })
                    }}
                  >
                    改名
                  </button>
                  <button disabled={mi === 0} onClick={() => void handleMove(major.id, 'up')}>
                    ↑
                  </button>
                  <button
                    disabled={mi === majors.length - 1}
                    onClick={() => void handleMove(major.id, 'down')}
                  >
                    ↓
                  </button>
                  <button className="danger" onClick={() => setDeleting(major)}>
                    删除
                  </button>
                </span>
              </div>
              {subs.map((sub, si) => (
                <div className="cat-row sub" key={sub.id}>
                  <span className="cat-name">{sub.name}</span>
                  <span className="cat-actions">
                    <button
                      onClick={() => {
                        setError('')
                        setDialog({ kind: 'rename', target: sub })
                      }}
                    >
                      改名
                    </button>
                    <button disabled={si === 0} onClick={() => void handleMove(sub.id, 'up')}>
                      ↑
                    </button>
                    <button
                      disabled={si === subs.length - 1}
                      onClick={() => void handleMove(sub.id, 'down')}
                    >
                      ↓
                    </button>
                    <button className="danger" onClick={() => setDeleting(sub)}>
                      删除
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      <InputDialog
        open={dialog !== null}
        title={
          dialog?.kind === 'addMajor'
            ? '新增大科目'
            : dialog?.kind === 'addSub'
              ? `给「${dialog.parent.name}」添加子类`
              : '重命名分类'
        }
        placeholder="请输入名称（最多 20 个字）"
        initialValue={dialog?.kind === 'rename' ? dialog.target.name : ''}
        confirmText={dialog?.kind === 'rename' ? '保存' : '添加'}
        onCancel={() => setDialog(null)}
        onConfirm={handleConfirm}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="删除分类"
        message={
          deleting
            ? deleting.parentId === null
              ? `删除「${deleting.name}」将同时删除其下 ${childrenOf(deleting.id).length} 个子类。已记录的账单不受影响，仍会保留原来的分类名称。确定删除吗？`
              : `删除「${deleting.name}」后，已记录的账单不受影响，仍会保留原来的分类名称。确定删除吗？`
            : ''
        }
        onCancel={() => setDeleting(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}

export default Categories
