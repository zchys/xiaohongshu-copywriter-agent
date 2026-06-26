import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import GeneratedPostCard from '@/components/GeneratedPostCard'

type Track = 'cold_facts' | 'parenting'

interface GeneratedPost {
  title: string
  body: string
  tags: string[]
  cover_text: string
  hook_line: string
  cta: string
  image_prompts: { role: string; description: string; style: string; aspect_ratio: string }[]
  content_type: string
  estimated_length: string
}

const trackOptions = [
  { value: 'cold_facts' as Track, label: '冷知识科普', icon: '🧊', desc: '有趣、反常识、涨知识', color: 'from-cyan-500 to-blue-500' },
  { value: 'parenting' as Track, label: '育儿科普', icon: '👶', desc: '专业、实用、可信赖', color: 'from-pink-500 to-rose-500' },
]

const angleOptions: Record<Track, string[]> = {
  cold_facts: ['反常识', '数据冲击', '历史揭秘', '科学探索', '生活窍门', '动物趣闻'],
  parenting: ['喂养', '睡眠', '发育', '疾病护理', '早教', '日常护理'],
}

const emotionOptions = ['惊讶', '好奇', '共鸣', '紧迫', '温馨', '幽默']

export default function GeneratePage() {
  const [track, setTrack] = useState<Track>('cold_facts')
  const [topic, setTopic] = useState('')
  const [angle, setAngle] = useState('')
  const [emotion, setEmotion] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<GeneratedPost | null>(null)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    if (!topic.trim()) return
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track, topic, angle, emotion }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '生成失败')
      }
      setResult(await res.json())
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* 页面标题 */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-xhs-500 to-orange-400 bg-clip-text text-transparent">
          ✨ 生成文案
        </h1>
        <p className="text-muted-foreground mt-2">输入话题，AI 帮你写出爆款小红书帖子</p>
      </div>

      {/* 赛道选择 */}
      <Card className="border-border/50 bg-background/50 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">选择赛道</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {trackOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setTrack(opt.value); setAngle('') }}
                className={cn(
                  'relative p-5 rounded-2xl border-2 transition-all duration-300 text-left group overflow-hidden',
                  track === opt.value
                    ? 'border-xhs-500/50 bg-xhs-500/5 shadow-lg shadow-xhs-500/10'
                    : 'border-border/50 hover:border-border hover:bg-muted/30'
                )}
              >
                {/* 背景渐变 */}
                <div className={cn(
                  'absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br',
                  opt.color,
                  track === opt.value ? 'opacity-5' : ''
                )} />

                <div className="relative">
                  <div className="text-3xl mb-3">{opt.icon}</div>
                  <div className="font-semibold text-base">{opt.label}</div>
                  <div className="text-xs text-muted-foreground mt-1.5">{opt.desc}</div>
                </div>

                {track === opt.value && (
                  <div className="absolute top-3 right-3">
                    <Badge className="bg-xhs-500 text-white border-0 shadow-lg shadow-xhs-500/30">
                      ✓
                    </Badge>
                  </div>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 输入区域 */}
      <Card className="border-border/50 bg-background/50 backdrop-blur">
        <CardContent className="p-6 space-y-5">
          {/* 话题 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">话题 *</label>
            <Textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={track === 'cold_facts' ? '例如：人体冷知识、太空趣闻、动物世界' : '例如：6个月宝宝辅食、宝宝夜醒、早教方法'}
              className="min-h-[80px] resize-none bg-muted/30 border-border/50 focus:border-xhs-500/50 transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleGenerate()}
            />
          </div>

          {/* 角度 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">角度（可选）</label>
            <div className="flex flex-wrap gap-2">
              {angleOptions[track].map((a) => (
                <Badge
                  key={a}
                  variant={angle === a ? 'default' : 'outline'}
                  className={cn(
                    'cursor-pointer transition-all duration-200 hover:scale-105',
                    angle === a
                      ? 'bg-xhs-500 text-white hover:bg-xhs-600 shadow-lg shadow-xhs-500/25'
                      : 'bg-muted/30 hover:bg-muted/50'
                  )}
                  onClick={() => setAngle(angle === a ? '' : a)}
                >
                  {a}
                </Badge>
              ))}
            </div>
          </div>

          {/* 情绪 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">情绪基调（可选）</label>
            <div className="flex flex-wrap gap-2">
              {emotionOptions.map((e) => (
                <Badge
                  key={e}
                  variant={emotion === e ? 'default' : 'outline'}
                  className={cn(
                    'cursor-pointer transition-all duration-200 hover:scale-105',
                    emotion === e
                      ? 'bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-500/25'
                      : 'bg-muted/30 hover:bg-muted/50'
                  )}
                  onClick={() => setEmotion(emotion === e ? '' : e)}
                >
                  {e}
                </Badge>
              ))}
            </div>
          </div>

          {/* 生成按钮 */}
          <Button
            onClick={handleGenerate}
            disabled={loading || !topic.trim()}
            className={cn(
              'w-full h-14 text-base font-semibold rounded-xl transition-all duration-300',
              'bg-gradient-to-r from-xhs-500 to-orange-400 hover:from-xhs-600 hover:to-orange-500',
              'shadow-lg shadow-xhs-500/25 hover:shadow-xl hover:shadow-xhs-500/30',
              'disabled:opacity-50 disabled:shadow-none'
            )}
          >
            {loading ? (
              <>
                <span className="spinner mr-2" />
                AI 正在创作中...
              </>
            ) : (
              '🚀 开始生成'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* 错误提示 */}
      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4">
            <p className="text-red-400 text-sm">❌ {error}</p>
          </CardContent>
        </Card>
      )}

      {/* 生成结果 */}
      {result && <GeneratedPostCard post={result} />}
    </div>
  )
}
