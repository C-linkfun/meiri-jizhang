import { centsToYuan, formatMoney } from '../utils/money'
import { formatDateCn } from '../utils/date'
import type { DayGroup, RecordItem } from '../../../shared/types'

interface BillListProps {
  groups: DayGroup[]
  onEdit: (record: RecordItem) => void
  onDelete: (record: RecordItem) => void
}

/** 按天分组的账单列表：日头显示当日收支合计，行点击编辑、行尾删除 */
function BillList({ groups, onEdit, onDelete }: BillListProps): React.JSX.Element {
  return (
    <>
      {groups.map((group) => (
        <div className="bill-group" key={group.date}>
          <div className="bill-day-header">
            <span>{formatDateCn(group.date)}</span>
            <span>
              收入 ¥{centsToYuan(group.income)} · 支出 ¥{centsToYuan(group.expense)}
            </span>
          </div>
          <div className="bill-card">
            {group.records.map((rec) => (
              <div className="bill-row" key={rec.id} onClick={() => onEdit(rec)}>
                <span className="bill-cat">
                  {rec.subcategory} · {rec.category}
                  {rec.note && <span className="bill-note">（{rec.note}）</span>}
                </span>
                <span className="bill-right">
                  <span className={`bill-amount ${rec.type}`}>
                    {formatMoney(rec.amount, rec.type)}
                  </span>
                  <button
                    className="bill-delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(rec)
                    }}
                  >
                    删除
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

export default BillList
