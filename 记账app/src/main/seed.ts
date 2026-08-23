import type { DatabaseSync } from 'node:sqlite'
import type { RecordType } from '../shared/types'

// 预置分类（CLAUDE.md 第四章）：16 个大科目 + 76 个子类
interface SeedCategory {
  type: RecordType
  name: string
  children: string[]
}

const SEED_CATEGORIES: SeedCategory[] = [
  {
    type: 'expense',
    name: '餐饮',
    children: ['早餐', '堂食正餐', '外卖', '买菜做饭', '零食饮料', '水果', '咖啡奶茶', '请客聚餐']
  },
  {
    type: 'expense',
    name: '交通',
    children: [
      '公交地铁',
      '打车',
      '加油',
      '停车费',
      '火车高铁',
      '飞机票',
      '汽车保养维修',
      '共享单车'
    ]
  },
  {
    type: 'expense',
    name: '购物',
    children: ['衣服鞋帽', '日用品百货', '数码家电', '美妆护肤', '家居用品', '宠物用品', '书籍']
  },
  {
    type: 'expense',
    name: '居住',
    children: ['房租房贷', '物业费', '水费', '电费', '燃气费', '家居维修', '其他居住']
  },
  {
    type: 'expense',
    name: '通讯',
    children: ['手机话费', '宽带费', '流量充值', '软件会员订阅', '其他通讯']
  },
  {
    type: 'expense',
    name: '医疗',
    children: ['门诊挂号', '买药', '体检', '住院治疗', '保健品']
  },
  {
    type: 'expense',
    name: '教育',
    children: ['学费', '培训课程', '兴趣班', '考试报名', '学习用品']
  },
  {
    type: 'expense',
    name: '人情',
    children: ['红包礼金', '份子钱', '送礼', '孝敬长辈']
  },
  {
    type: 'expense',
    name: '娱乐',
    children: ['电影演出', '游戏充值', '旅游出行', '健身运动', '休闲聚会']
  },
  {
    type: 'expense',
    name: '其他',
    children: ['罚款', '慈善捐款', '意外支出', '其他杂项']
  },
  {
    type: 'income',
    name: '工资收入',
    children: ['月薪工资', '奖金', '加班费', '补贴']
  },
  {
    type: 'income',
    name: '投资理财',
    children: ['银行利息', '基金收益', '股票收益', '房租收入']
  },
  {
    type: 'income',
    name: '兼职外快',
    children: ['副业收入', '接单劳务', '稿费']
  },
  {
    type: 'income',
    name: '人情往来',
    children: ['收到红包', '礼金']
  },
  {
    type: 'income',
    name: '报销退款',
    children: ['报销款', '退款退货']
  },
  {
    type: 'income',
    name: '其他收入',
    children: ['二手转卖', '中奖', '其他']
  }
]

/** 首次启动（分类表为空）时写入预置分类，幂等 */
export function seedCategoriesIfEmpty(db: DatabaseSync): void {
  const row = db.prepare('SELECT COUNT(*) AS count FROM categories').get() as { count: number }
  if (row.count > 0) return

  const insert = db.prepare(
    'INSERT INTO categories (type, parent_id, name, sort_order) VALUES (?, ?, ?, ?)'
  )
  db.exec('BEGIN IMMEDIATE')
  try {
    SEED_CATEGORIES.forEach((major, i) => {
      const { lastInsertRowid } = insert.run(major.type, null, major.name, (i + 1) * 10)
      major.children.forEach((child, j) => {
        insert.run(major.type, lastInsertRowid, child, (j + 1) * 10)
      })
    })
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}
