import { useEffect, useState } from 'react'
import type { EChartsOption } from 'echarts'
import { api } from '../api'
import { centsToYuan, formatMoney } from '../utils/money'
import { todayStr } from '../utils/date'
import MonthSwitcher from '../components/MonthSwitcher'
import EChart from '../components/EChart'
import type {
  CategoryStat,
  MonthCategoryStats,
  MonthlySummary,
  RecordType,
  TrendPoint
} from '../../../shared/types'

// 饼图分类色板：按 dataviz 规范固定顺序（已通过校验脚本）
const PIE_COLORS = [
  '#2a78d6',
  '#eb6834',
  '#1baf7a',
  '#eda100',
  '#e87ba4',
  '#008300',
  '#4a3aa7',
  '#e34948'
]
// 趋势图：收入绿（实线 + 圆点）与支出红（虚线 + 菱形）双重区分，色盲可辨（校验 6.0，带次级编码）
const INCOME_COLOR = '#2e9e6b'
const EXPENSE_COLOR = '#e34948'

const PIE_MAX_SLICES = 8

/** 分类占比环形图；超过 8 项时取前 7 项，其余合并为「其余项目」 */
function buildPieOption(items: CategoryStat[]): EChartsOption | null {
  if (items.length === 0) return null
  let slices = items
  if (items.length > PIE_MAX_SLICES) {
    const top = items.slice(0, PIE_MAX_SLICES - 1)
    const rest = items.slice(PIE_MAX_SLICES - 1)
    slices = [
      ...top,
      {
        name: '其余项目',
        amount: rest.reduce((s, x) => s + x.amount, 0),
        count: rest.reduce((s, x) => s + x.count, 0)
      }
    ]
  }
  const total = slices.reduce((s, x) => s + x.amount, 0)

  return {
    color: PIE_COLORS,
    tooltip: {
      trigger: 'item',
      backgroundColor: '#fff',
      borderColor: '#e4e9e7',
      textStyle: { color: '#2b2f2e', fontSize: 12 },
      formatter: (p) => `${p.name}<br/>¥ ${centsToYuan(p.value as number)}（${p.percent}%）`
    },
    series: [
      {
        type: 'pie',
        radius: ['52%', '74%'],
        center: ['50%', '46%'],
        itemStyle: { borderColor: '#ffffff', borderWidth: 2 },
        emphasis: { scaleSize: 4 },
        label: {
          show: false,
          color: '#52514e',
          fontSize: 12,
          formatter: '{b} {d}%'
        },
        labelLine: { show: false, length: 10, length2: 8 },
        // 只给占比 >= 5% 的扇区直接标注，其余靠下方明细列表
        data: slices.map((s) => {
          const percent = (s.amount / total) * 100
          return {
            name: s.name,
            value: s.amount,
            label: { show: percent >= 5 },
            labelLine: { show: percent >= 5 }
          }
        })
      }
    ]
  }
}

/** 月度收支趋势折线图 */
function buildTrendOption(points: TrendPoint[]): EChartsOption {
  return {
    color: [INCOME_COLOR, EXPENSE_COLOR],
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#fff',
      borderColor: '#e4e9e7',
      textStyle: { color: '#2b2f2e', fontSize: 12 },
      formatter: (params) => {
        const list = params as {
          marker: string
          seriesName: string
          value: number
          axisValueLabel: string
        }[]
        if (!list.length) return ''
        return `${list[0].axisValueLabel}<br/>${list
          .map((p) => `${p.marker}${p.seriesName}：¥ ${centsToYuan(p.value)}`)
          .join('<br/>')}`
      }
    },
    legend: {
      show: true,
      top: 0,
      right: 0,
      itemWidth: 18,
      itemHeight: 10,
      textStyle: { color: '#52514e', fontSize: 12 }
    },
    grid: { left: 10, right: 10, top: 34, bottom: 4, containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: points.map((p) => shortMonthLabel(p.month)),
      axisLine: { lineStyle: { color: '#c3c2b7' } },
      axisTick: { show: false },
      axisLabel: { color: '#898781', fontSize: 11 }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#e1e0d9' } },
      axisLabel: {
        color: '#898781',
        fontSize: 11,
        formatter: (v: number) => (v / 100).toLocaleString('zh-CN', { maximumFractionDigits: 0 })
      }
    },
    series: [
      {
        name: '收入',
        type: 'line',
        data: points.map((p) => p.income),
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { width: 2 },
        itemStyle: { borderColor: '#fff', borderWidth: 1.5 }
      },
      {
        name: '支出',
        type: 'line',
        data: points.map((p) => p.expense),
        symbol: 'diamond',
        symbolSize: 8,
        lineStyle: { width: 2, type: 'dashed' },
        itemStyle: { borderColor: '#fff', borderWidth: 1.5 }
      }
    ]
  }
}

function shortMonthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return m === 1 ? `${y}/${m}` : `${m}月`
}

function Stats(): React.JSX.Element {
  const [month, setMonth] = useState(todayStr().slice(0, 7))
  const [summary, setSummary] = useState<MonthlySummary | null>(null)
  const [catStats, setCatStats] = useState<MonthCategoryStats | null>(null)
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [pieType, setPieType] = useState<RecordType>('expense')
  const [budget, setBudget] = useState<number | null>(null)

  useEffect(() => {
    void api.records.getMonthlySummary(month).then(setSummary)
    void api.records.getMonthCategoryStats(month).then(setCatStats)
    void api.records.getMonthlyTrend(month, 12).then(setTrend)
    void api.settings.getBudget().then(setBudget)
  }, [month])

  const monthExpense = summary?.expense ?? 0
  const budgetPercent =
    budget !== null && budget > 0 ? Math.round((monthExpense / budget) * 100) : null
  const budgetOver = budgetPercent !== null && budgetPercent >= 100

  const pieItems = pieType === 'expense' ? (catStats?.expense ?? []) : (catStats?.income ?? [])
  const pieOption = buildPieOption(pieItems)
  const pieTotal = pieItems.reduce((s, x) => s + x.amount, 0)
  const trendEmpty = trend.every((p) => p.income === 0 && p.expense === 0)

  return (
    <div className="page">
      <h2 className="page-title">统计</h2>
      <MonthSwitcher month={month} onChange={setMonth} />
      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-label">本月收入</div>
          <div className="summary-amount income">{formatMoney(summary?.income ?? 0)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">本月支出</div>
          <div className="summary-amount expense">{formatMoney(summary?.expense ?? 0)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">本月结余</div>
          <div className="summary-amount balance">{formatMoney(summary?.balance ?? 0)}</div>
        </div>
      </div>
      <p className="count-line">本月共记账 {summary?.count ?? 0} 笔</p>

      {budget !== null && budgetPercent !== null ? (
        <div className="budget-block">
          <div className="budget-head">
            <span className="budget-title">本月预算</span>
            <span className="budget-nums">
              支出 ¥ {centsToYuan(monthExpense)} / 预算 ¥ {centsToYuan(budget)}（{budgetPercent}%）
            </span>
          </div>
          <div className="budget-track">
            <div
              className="budget-fill"
              style={{
                width: `${Math.min(budgetPercent, 100)}%`,
                background: budgetOver
                  ? EXPENSE_COLOR
                  : budgetPercent >= 80
                    ? '#eda100'
                    : 'var(--primary)'
              }}
            />
          </div>
          <p className="budget-hint">
            {budgetOver
              ? `已超出预算 ¥ ${centsToYuan(monthExpense - budget)}`
              : `剩余可用 ¥ ${centsToYuan(budget - monthExpense)}`}
          </p>
        </div>
      ) : (
        <p className="page-hint">在「设置」页可以设置月度预算，本月支出接近或超出时会提醒您</p>
      )}

      <div className="section-title">分类占比</div>
      <div className="tabs">
        <button
          className={`tab${pieType === 'expense' ? ' active' : ''}`}
          onClick={() => setPieType('expense')}
        >
          支出构成
        </button>
        <button
          className={`tab${pieType === 'income' ? ' active' : ''}`}
          onClick={() => setPieType('income')}
        >
          收入构成
        </button>
      </div>
      <div className="chart-card">
        {pieOption ? (
          <>
            <EChart option={pieOption} height={280} />
            <ul className="pie-list">
              {pieItems.map((item, i) => (
                <li key={item.name}>
                  <span
                    className="pie-dot"
                    style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span className="pie-name">{item.name}</span>
                  <span className="pie-meta">{item.count} 笔</span>
                  <span className="pie-amount">{formatMoney(item.amount)}</span>
                  <span className="pie-percent">
                    {pieTotal > 0 ? ((item.amount / pieTotal) * 100).toFixed(1) : '0.0'}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="empty-state">本月还没有账单，记几笔后这里会显示分类占比</div>
        )}
      </div>

      <div className="section-title">月度收支趋势（近 12 个月）</div>
      <div className="chart-card">
        {trendEmpty ? (
          <div className="empty-state">暂时还没有足够的数据来展示趋势</div>
        ) : (
          <EChart option={buildTrendOption(trend)} height={280} />
        )}
      </div>
    </div>
  )
}

export default Stats
