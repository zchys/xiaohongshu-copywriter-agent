import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { cn } from '@/lib/utils'

type Track = 'cold_facts' | 'parenting'

interface Stats {
  cold_facts: { notes: number; patterns: number; facts: number; generations: number }
  parenting: { notes: number; patterns: number; facts: number; generations: number }
}

interface TrendPoint { date: string; count: number }
interface CategoryPoint { name: string; value: number }

const COLORS = ['#ff2442', '#ff6b6b', '#ffa07a', '#ffd700', '#7c3aed', '#06b6d4', '#10b981', '#f59e0b']

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border/50 bg-background/95 backdrop-blur p-3 shadow-xl">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-sm font-medium" style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

export default function StatsPage() {
  const [track, setTrack] = useState<Track>('cold_facts')
  const [stats, setStats] = useState<Stats | null>(null)
  const [trend, setTrend] = useState<TrendPoint[]>([])
  const [categories, setCategories] = useState<CategoryPoint[]>([])

  useEffect(() => { fetchStats() }, [])
  useEffect(() => { fetchTrend(); fetchCategories() }, [track])

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats')
      setStats(await res.json())
    } catch (err) { console.error('获取统计失败:', err) }
  }

  const fetchTrend = async () => {
    try {
      const res = await fetch(`/api/stats/trend?track=${track}&days=30`)
      setTrend(await res.json())
    } catch (err) { console.error('获取趋势失败:', err) }
  }

  const fetchCategories = async () => {
    try {
      const res = await fetch(`/api/stats/categories?track=${track}`)
      setCategories(await res.json())
    } catch (err) { console.error('获取分类失败:', err) }
  }

  const trackData = stats?.[track]

  const statCards = trackData ? [
    { label: '采集帖子', value: trackData.notes, icon: '📝', gradient: 'from-blue-500 to-cyan-500' },
    { label: '写作套路', value: trackData.patterns, icon: '🎯', gradient: 'from-purple-500 to-pink-500' },
    { label: '知识点', value: trackData.facts, icon: '💡', gradient: 'from-amber-500 to-orange-500' },
    { label: '生成记录', value: trackData.generations, icon: '✨', gradient: 'from-emerald-500 to-teal-500' },
  ] : []

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-xhs-500 to-orange-400 bg-clip-text text-transparent">
            📊 数据统计
          </h1>
          <p className="text-muted-foreground mt-2">查看知识库和生成数据分析</p>
        </div>
        <div className="flex gap-2">
          {(['cold_facts', 'parenting'] as const).map((t) => (
            <Badge
              key={t}
              variant={track === t ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer transition-all duration-200 hover:scale-105',
                track === t
                  ? 'bg-xhs-500 text-white shadow-lg shadow-xhs-500/25'
                  : 'bg-muted/30 hover:bg-muted/50'
              )}
              onClick={() => setTrack(t)}
            >
              {t === 'cold_facts' ? '🧊 冷知识' : '👶 育儿'}
            </Badge>
          ))}
        </div>
      </div>

      {/* 数值卡片 */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <Card key={i} className="border-border/50 bg-background/50 backdrop-blur group hover:border-xhs-500/20 transition-all duration-300">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-2xl">{card.icon}</span>
                <div className={cn('w-10 h-10 rounded-xl bg-gradient-to-br opacity-20 group-hover:opacity-40 transition-opacity', card.gradient)} />
              </div>
              <div className="text-3xl font-bold">{card.value.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground mt-1">{card.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 图表区域 */}
      <div className="grid grid-cols-2 gap-6">
        {/* 生成趋势 */}
        <Card className="border-border/50 bg-background/50 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">📈 近30天生成趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ff2442" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ff2442" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fill: '#8b949e', fontSize: 11 }}
                    tickFormatter={(val) => val.slice(5)}
                  />
                  <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fill: '#8b949e', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#ff2442"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorCount)"
                    name="生成数"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* 知识点分类分布 */}
        <Card className="border-border/50 bg-background/50 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">📂 知识点分类分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {categories.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categories}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {categories.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: '12px', color: '#8b949e' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  暂无数据
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 分类详情 */}
      {categories.length > 0 && (
        <Card className="border-border/50 bg-background/50 backdrop-blur">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              📊 分类详情 — {track === 'cold_facts' ? '冷知识科普' : '育儿科普'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categories} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" tick={{ fill: '#8b949e', fontSize: 11 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="hsl(var(--muted-foreground))"
                    tick={{ fill: '#8b949e', fontSize: 12 }}
                    width={80}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="value"
                    fill="#ff2442"
                    radius={[0, 8, 8, 0]}
                    name="数量"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 空状态 */}
      {stats && trackData?.notes === 0 && (
        <Card className="border-border/50 bg-background/50">
          <CardContent className="p-16 text-center">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-lg text-muted-foreground">还没有数据</p>
            <p className="text-sm text-muted-foreground/60 mt-2">先运行采集脚本：npm run crawl {track}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
