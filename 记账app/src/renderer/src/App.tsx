import { useState } from 'react'
import Home from './pages/Home'
import Ledger from './pages/Ledger'
import Stats from './pages/Stats'
import Categories from './pages/Categories'
import Settings from './pages/Settings'

const NAV_ITEMS = [
  { key: 'home', label: '今日记账' },
  { key: 'ledger', label: '账单流水' },
  { key: 'stats', label: '统计' },
  { key: 'categories', label: '分类管理' },
  { key: 'settings', label: '设置' }
] as const

type PageKey = (typeof NAV_ITEMS)[number]['key']

const PAGES: Record<PageKey, () => React.JSX.Element> = {
  home: Home,
  ledger: Ledger,
  stats: Stats,
  categories: Categories,
  settings: Settings
}

function App(): React.JSX.Element {
  const [page, setPage] = useState<PageKey>('home')
  const Page = PAGES[page]

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="app-title">
          <span className="app-logo">记</span>
          <div>
            <div className="app-name">每日记账</div>
            <div className="app-sub">记录每一天的收支</div>
          </div>
        </div>
        <nav className="nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={`nav-item${page === item.key ? ' active' : ''}`}
              onClick={() => setPage(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">v0.1.0 · 开发中</div>
      </aside>
      <main className="content">
        <Page />
      </main>
    </div>
  )
}

export default App
