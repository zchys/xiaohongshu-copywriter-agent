import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

type Track = 'cold_facts' | 'parenting'

interface Generation {
  id: number
  track: Track
  topic: string
  angle: string
  emotion: string
  output: {
    title: string
    body: string
    tags: string[]
    cover_text: string
    image_prompts: { role: string; description: string }[]
  }
  model: string
  user_rating: number | null
  user_note: string
  created_at: string
}

export default function HistoryPage() {
  const [generations, setGenerations] = useState<Generation[]>([])
  const [filter, setFilter] = useState<Track | 'all'>('all')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchHistory() }, [filter])

  const fetchHistory = async () => {
    setLoading(true)
    try {
      const params = filter === 'all' ? '' : `?track=${filter}`
      const res = await fetch(`/api/generations${params}`)
      setGenerations(await res.json())
    } catch (err) {
      console.error('获取历史失败:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRate = async (id: number, rating: number) => {
    try {
      await fetch(`/api/generations/${id}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      })
      setGenerations(prev => prev.map(g => g.id === id ? { ...g, user_rating: rating } : g))
    } catch (err) {
      console.error('评分失败:', err)
    }
  }

  const trackLabels: Record<string, { icon: string; color: string }> = {
    cold_facts: { icon: '🧊', color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20' },
    parenting:  { icon: '👶', color: 'bg-pink-500/15 text-pink-400 border-pink-500/20' },
  }

  const filters = [
    { value: 'all' as const, label: '全部', icon: '📁' },
    { value: 'cold_facts' as const, label: '冷知识', icon: '🧊' },
    { value: 'parenting' as const, label: '育儿', icon: '👶' },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-xhs-500 to-orange-400 bg-clip-text text-transparent">
            📜 生成历史
          </h1>
          <p className="text-muted-foreground mt-2">查看过往生成记录，给优质内容打分</p>
        </div>
        <Badge variant="outline" className="bg-muted/30">
          共 {generations.length} 条
        </Badge>
      </div>

      {/* 筛选器 */}
      <div className="flex gap-2">
        {filters.map((f) => (
          <Badge
            key={f.value}
            variant={filter === f.value ? 'default' : 'outline'}
            className={cn(
              'cursor-pointer transition-all duration-200 hover:scale-105 px-4 py-1.5',
              filter === f.value
                ? 'bg-xhs-500 text-white shadow-lg shadow-xhs-500/25'
                : 'bg-muted/30 hover:bg-muted/50'
            )}
            onClick={() => setFilter(f.value)}
          >
            {f.icon} {f.label}
          </Badge>
        ))}
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="spinner" />
        </div>
      ) : generations.length === 0 ? (
        <Card className="border-border/50 bg-background/50">
          <CardContent className="p-16 text-center">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-lg text-muted-foreground">还没有生成记录</p>
            <p className="text-sm text-muted-foreground/60 mt-2">去「生成文案」页面创建第一条吧</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {generations.map((gen) => {
            const trackInfo = trackLabels[gen.track] || { icon: '📝', color: '' }
            return (
              <Card key={gen.id} className="border-border/50 bg-background/50 backdrop-blur overflow-hidden hover:border-xhs-500/20 transition-colors">
                {/* 摘要行 */}
                <button
                  onClick={() => setExpandedId(expandedId === gen.id ? null : gen.id)}
                  className="w-full p-4 flex items-center gap-4 hover:bg-muted/20 transition-colors text-left"
                >
                  <span className="text-2xl">{trackInfo.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{gen.output.title}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs bg-muted/30">{gen.topic}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {gen.created_at?.slice(0, 16)?.replace('T', ' ')}
                      </span>
                    </div>
                  </div>

                  {/* 评分 */}
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={(e) => { e.stopPropagation(); handleRate(gen.id, star) }}
                        className="text-lg transition-all duration-200 hover:scale-125"
                      >
                        {star <= (gen.user_rating || 0) ? '⭐' : '☆'}
                      </button>
                    ))}
                  </div>

                  <span className="text-muted-foreground text-sm ml-2">
                    {expandedId === gen.id ? '▲' : '▼'}
                  </span>
                </button>

                {/* 展开详情 */}
                {expandedId === gen.id && (
                  <div className="p-4 pt-0 space-y-4 animate-slide-in">
                    <Separator className="opacity-30" />

                    {/* 标签 */}
                    <div className="flex flex-wrap gap-2">
                      {gen.output.tags?.map((tag: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs bg-xhs-500/10 text-xhs-400 border-xhs-500/20">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    {/* 正文 */}
                    <div className="p-4 rounded-xl bg-muted/20 whitespace-pre-wrap text-sm max-h-64 overflow-y-auto border border-border/30">
                      {gen.output.body}
                    </div>

                    {/* 图片提示词 */}
                    {gen.output.image_prompts?.length > 0 && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-2">🎨 图片提示词</div>
                        <div className="space-y-2">
                          {gen.output.image_prompts.map((p: any, i: number) => (
                            <div key={i} className="p-3 rounded-lg bg-muted/20 text-xs font-mono text-muted-foreground border border-border/30">
                              <span className="text-foreground/60">[{p.role}] </span>
                              {p.description}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 元信息 */}
                    <div className="flex gap-4 text-xs text-muted-foreground/60">
                      <span>模型: {gen.model}</span>
                      <span>角度: {gen.angle || '-'}</span>
                      <span>情绪: {gen.emotion || '-'}</span>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
