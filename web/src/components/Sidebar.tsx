import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

type Page = 'generate' | 'history' | 'stats'

interface SidebarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
}

const navItems = [
  { id: 'generate' as Page, label: '生成文案', icon: '✨', desc: '创建新帖子' },
  { id: 'history'  as Page, label: '生成历史', icon: '📜', desc: '查看过往记录' },
  { id: 'stats'    as Page, label: '数据统计', icon: '📊', desc: '查看数据分析' },
]

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside className="w-64 h-screen flex flex-col shrink-0 border-r border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Logo */}
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-xhs-500 to-orange-400 flex items-center justify-center text-lg font-bold text-white shadow-lg shadow-xhs-500/25">
            书
          </div>
          <div>
            <h1 className="text-base font-bold bg-gradient-to-r from-xhs-500 to-orange-400 bg-clip-text text-transparent">
              文案智能体
            </h1>
            <p className="text-xs text-muted-foreground">小红书 · 内容创作</p>
          </div>
        </div>
      </div>

      <Separator className="mx-4 opacity-50" />

      {/* 导航 */}
      <nav className="flex-1 p-4 space-y-1.5">
        {navItems.map((item) => {
          const isActive = currentPage === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group',
                isActive
                  ? 'bg-gradient-to-r from-xhs-500/20 to-orange-400/10 text-white shadow-sm border border-xhs-500/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <span className={cn(
                'text-xl transition-transform duration-200',
                isActive && 'scale-110',
                'group-hover:scale-105'
              )}>
                {item.icon}
              </span>
              <div className="text-left">
                <div className="text-sm font-medium">{item.label}</div>
                <div className={cn(
                  'text-xs',
                  isActive ? 'text-xhs-400' : 'text-muted-foreground/60'
                )}>
                  {item.desc}
                </div>
              </div>
              {isActive && (
                <div className="ml-auto w-1.5 h-8 rounded-full bg-gradient-to-b from-xhs-500 to-orange-400" />
              )}
            </button>
          )
        })}
      </nav>

      {/* 底部信息 */}
      <div className="p-4">
        <div className="rounded-xl border border-border/50 bg-muted/30 p-3 text-center space-y-1">
          <div className="flex justify-center gap-2">
            <Badge variant="secondary" className="text-xs bg-xhs-500/10 text-xhs-400 border-xhs-500/20">
              🧊 冷知识
            </Badge>
            <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/20">
              👶 育儿
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground/60">双赛道独立运作</p>
        </div>
      </div>
    </aside>
  )
}
