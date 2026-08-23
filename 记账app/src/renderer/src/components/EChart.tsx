import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'

interface EChartProps {
  option: EChartsOption
  height?: number
}

/** ECharts 通用容器：初始化、option 更新、窗口尺寸自适应、卸载清理 */
function EChart({ option, height = 300 }: EChartProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!ref.current) return
    const chart = echarts.init(ref.current)
    chartRef.current = chart
    const observer = new ResizeObserver(() => chart.resize())
    observer.observe(ref.current)
    return () => {
      observer.disconnect()
      chart.dispose()
      chartRef.current = null
    }
  }, [])

  useEffect(() => {
    // notMerge：数据切换（如换月份）时完全替换，避免残留旧 series
    chartRef.current?.setOption(option, true)
  }, [option])

  return <div ref={ref} style={{ height, width: '100%' }} />
}

export default EChart
