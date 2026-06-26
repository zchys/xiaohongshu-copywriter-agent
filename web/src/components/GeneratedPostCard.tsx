import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface ImagePrompt {
  role: string
  description: string
  style: string
  aspect_ratio: string
}

interface GeneratedPost {
  title: string
  body: string
  tags: string[]
  cover_text: string
  hook_line: string
  cta: string
  image_prompts: ImagePrompt[]
  content_type: string
  estimated_length: string
}

export default function GeneratedPostCard({ post }: { post: GeneratedPost }) {
  const [copiedField, setCopiedField] = useState('')

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(''), 2000)
  }

  const CopyBtn = ({ text, field }: { text: string; field: string }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => copyToClipboard(text, field)}
      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
    >
      {copiedField === field ? '✅ 已复制' : '📋 复制'}
    </Button>
  )

  return (
    <Card className="border-border/50 bg-background/50 backdrop-blur overflow-hidden animate-fade-in">
      {/* 渐变头部 */}
      <div className="bg-gradient-to-r from-xhs-500/10 via-orange-400/5 to-transparent p-5 border-b border-border/30">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold bg-gradient-to-r from-xhs-500 to-orange-400 bg-clip-text text-transparent">
            📝 生成结果
          </h3>
          <div className="flex gap-2">
            <Badge className="bg-xhs-500/15 text-xhs-400 border-xhs-500/20">
              {post.content_type === 'single' ? '单图' : '多图'}
            </Badge>
            <Badge variant="outline" className="bg-muted/30">
              {post.estimated_length}
            </Badge>
          </div>
        </div>
      </div>

      <CardContent className="p-6 space-y-5">
        {/* 封面文字 */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-xhs-500/5 to-orange-400/5 border border-xhs-500/10">
          <div className="text-4xl">🖼️</div>
          <div className="flex-1">
            <div className="text-xs text-muted-foreground mb-1">封面文字</div>
            <div className="text-xl font-bold">{post.cover_text}</div>
          </div>
          <CopyBtn text={post.cover_text} field="cover" />
        </div>

        <Separator className="opacity-30" />

        {/* 标题 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-muted-foreground">📌 标题</label>
            <CopyBtn text={post.title} field="title" />
          </div>
          <div className="p-4 rounded-xl bg-muted/30 text-lg font-medium border border-border/30">
            {post.title}
          </div>
        </div>

        {/* 开头钩子 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-muted-foreground">🪝 开头钩子</label>
            <CopyBtn text={post.hook_line} field="hook" />
          </div>
          <div className="p-4 rounded-xl bg-muted/30 italic text-muted-foreground border border-border/30">
            {post.hook_line}
          </div>
        </div>

        {/* 正文 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-muted-foreground">📄 正文</label>
            <CopyBtn text={post.body} field="body" />
          </div>
          <div className="p-4 rounded-xl bg-muted/30 whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto border border-border/30">
            {post.body}
          </div>
        </div>

        {/* 标签 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-muted-foreground">🏷️ 话题标签</label>
            <CopyBtn text={post.tags.join(' ')} field="tags" />
          </div>
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag, i) => (
              <Badge key={i} variant="outline" className="bg-xhs-500/10 text-xhs-400 border-xhs-500/20 hover:bg-xhs-500/20 transition-colors">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        {/* 互动引导 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-muted-foreground">💬 互动引导</label>
            <CopyBtn text={post.cta} field="cta" />
          </div>
          <div className="p-4 rounded-xl bg-muted/30 border border-border/30">
            {post.cta}
          </div>
        </div>

        <Separator className="opacity-30" />

        {/* 图片提示词 */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-3 block">🎨 DALL·E 图片提示词</label>
          <div className="space-y-3">
            {post.image_prompts.map((prompt, i) => (
              <div key={i} className="p-4 rounded-xl bg-muted/20 border border-border/30 group hover:border-xhs-500/20 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {prompt.role === 'cover' ? '封面图' : '内容图'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{prompt.style}</span>
                  </div>
                  <CopyBtn text={prompt.description} field={`img-${i}`} />
                </div>
                <p className="text-sm font-mono text-muted-foreground leading-relaxed">
                  {prompt.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <Separator className="opacity-30" />

        {/* 一键复制全部 */}
        <Button
          variant="outline"
          className={cn(
            'w-full h-12 rounded-xl transition-all duration-300',
            'bg-muted/30 hover:bg-muted/50 border-border/50',
            copiedField === 'all' && 'border-green-500/50 bg-green-500/10'
          )}
          onClick={() => {
            const fullText = [
              `标题：${post.title}`,
              `正文：\n${post.body}`,
              `标签：${post.tags.join(' ')}`,
              `封面文字：${post.cover_text}`,
              `互动引导：${post.cta}`,
              `\n图片提示词：`,
              ...post.image_prompts.map((p, i) => `  ${i + 1}. [${p.role}] ${p.description}`),
            ].join('\n')
            copyToClipboard(fullText, 'all')
          }}
        >
          {copiedField === 'all' ? '✅ 已复制全部内容' : '📋 一键复制全部内容'}
        </Button>
      </CardContent>
    </Card>
  )
}
