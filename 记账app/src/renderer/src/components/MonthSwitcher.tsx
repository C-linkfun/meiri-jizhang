import { addMonths, monthLabel } from '../utils/date'

interface MonthSwitcherProps {
  month: string
  onChange: (month: string) => void
}

/** 月份切换条：‹ 2026年8月 › */
function MonthSwitcher({ month, onChange }: MonthSwitcherProps): React.JSX.Element {
  return (
    <div className="month-switcher">
      <button onClick={() => onChange(addMonths(month, -1))} title="上个月">
        ‹
      </button>
      <span className="month-switcher-label">{monthLabel(month)}</span>
      <button onClick={() => onChange(addMonths(month, 1))} title="下个月">
        ›
      </button>
    </div>
  )
}

export default MonthSwitcher
