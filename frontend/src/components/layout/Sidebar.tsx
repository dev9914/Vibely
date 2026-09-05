import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import {
  Home,
  Search,
  Film,
  MessageCircle,
  Bell,
  PlusSquare,
  Menu,
  Settings,
  LogOut,
  User,
  Heart,
  ChevronLeft,
  ChevronRight,
  Bookmark,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import NotificationPanel from '@/components/notifications/NotificationPanel'
import { useGetNotificationSummaryQuery } from '@/services/notificationApi'
import { useGetUnreadCountQuery } from '@/services/messageApi'
import { openCreatePostModal } from '@/store/uiSlice'
import { useLogout } from '@/hooks/useLogout'

interface SidebarProps {
  user: {
    _id?: string
    username?: string
    avatar?: string
    fullName?: string
  }
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
}

interface NavItem {
  icon: React.ElementType
  label: string
  href?: string
  onClick?: () => void
  isNotification?: boolean
  badgeCount?: number
}

const Sidebar = ({ user, collapsed = false, onCollapsedChange }: SidebarProps) => {
  const location = useLocation()
  const dispatch = useDispatch()
  const { logout, isLoading: isLoggingOut } = useLogout()
  const [isHovered, setIsHovered] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)

  // Get unread count for notification badge
  const { data: notificationData } = useGetNotificationSummaryQuery(undefined, {
    pollingInterval: 30000,
  })
  const unreadCount = notificationData?.unreadCount || 0
  const { data: unreadMessages } = useGetUnreadCountQuery(undefined, {
    skip: !user._id,
    pollingInterval: 30000,
  })
  const messageUnreadCount = unreadMessages?.count || 0

  // Sidebar stays collapsed when notification panel is open (like Instagram)
  // Only expand on hover or dropdown when not viewing notifications
  const isExpanded = !isNotificationOpen && (!collapsed || isHovered || isDropdownOpen)

  const navItems: NavItem[] = [
    { icon: Home, label: 'Home', href: '/' },
    { icon: Search, label: 'Search', href: '/search' },
    { icon: Film, label: 'Reels', href: '/reels' },
    { icon: MessageCircle, label: 'Messages', href: '/messages', badgeCount: messageUnreadCount },
    { icon: Bell, label: 'Notifications', isNotification: true, onClick: () => setIsNotificationOpen(true) },
    { icon: PlusSquare, label: 'Create', onClick: () => dispatch(openCreatePostModal()) },
    { icon: Bookmark, label: 'Saved', href: '/saved' },
  ]

  const isActive = (href?: string) => {
    if (!href) return false
    if (href === '/messages') {
      return location.pathname === href || location.pathname.startsWith('/chat/')
    }
    return location.pathname === href
  }

  const NavLink = ({ item }: { item: NavItem }) => {
    const content = (
      <>
        <div className="relative">
          <item.icon className={cn("h-6 w-6 shrink-0", !isExpanded && "h-7 w-7")} />
          {(item.badgeCount ?? 0) > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
              {(item.badgeCount ?? 0) > 99 ? '99+' : item.badgeCount}
            </span>
          )}
        </div>
        <span className={cn(
          "text-sm font-medium transition-all duration-200",
          isExpanded ? "opacity-100 ml-4" : "opacity-0 w-0 ml-0 overflow-hidden"
        )}>
          {item.label}
        </span>
      </>
    )

    const baseClass = cn(
      'flex items-center rounded-xl px-3 py-3 text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground',
      isExpanded ? 'w-full justify-start' : 'w-12 justify-center',
      isActive(item.href) && 'bg-accent text-foreground font-semibold'
    )

    const handleClick = () => {
      // Close notification panel when clicking any nav item
      setIsNotificationOpen(false)
      item.onClick?.()
    }

    if (!isExpanded) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            {item.href ? (
              <Link to={item.href} onClick={() => setIsNotificationOpen(false)} className={baseClass}>{content}</Link>
            ) : (
              <button onClick={handleClick} className={baseClass}>{content}</button>
            )}
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-card border-border">
            <p>{item.label}</p>
          </TooltipContent>
        </Tooltip>
      )
    }

    if (item.href) {
      return <Link to={item.href} onClick={() => setIsNotificationOpen(false)} className={baseClass}>{content}</Link>
    }

    return <button onClick={handleClick} className={baseClass}>{content}</button>
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside 
        className={cn(
          "fixed left-0 top-0 z-40 h-screen border-r border-border bg-background transition-all duration-300",
          isExpanded ? "w-[220px]" : "w-[72px]"
        )}
        onMouseEnter={() => collapsed && setIsHovered(true)}
        onMouseLeave={() => collapsed && setIsHovered(false)}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className={cn(
            "flex h-16 items-center transition-all duration-200",
            isExpanded ? "px-5 justify-start" : "px-0 justify-center"
          )}>
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400">
                <Heart className="h-5 w-5 text-white" fill="currentColor" />
              </div>
              <span className={cn(
                "text-xl font-bold text-foreground transition-all duration-200",
                isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
              )}>
                Vibely
              </span>
            </Link>
          </div>

          {/* Navigation */}
          <ScrollArea className="flex-1 px-3">
            <nav className="space-y-1 py-4">
              {navItems.map((item) => {
                if (item.isNotification) {
                  const notificationButton = (
                    <button
                      onClick={item.onClick}
                      className={cn(
                        'flex items-center rounded-xl px-3 py-3 text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground relative',
                        isExpanded ? 'w-full justify-start' : 'w-12 justify-center',
                        isNotificationOpen && 'bg-accent text-foreground font-semibold'
                      )}
                    >
                      <div className="relative">
                        <Bell className={cn("h-6 w-6 shrink-0", !isExpanded && "h-7 w-7")} />
                        {unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-red-500 rounded-full">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </div>
                      <span className={cn(
                        "text-sm font-medium transition-all duration-200",
                        isExpanded ? "opacity-100 ml-4" : "opacity-0 w-0 ml-0 overflow-hidden"
                      )}>
                        {item.label}
                      </span>
                    </button>
                  )

                  if (!isExpanded) {
                    return (
                      <Tooltip key={item.label}>
                        <TooltipTrigger asChild>
                          {notificationButton}
                        </TooltipTrigger>
                        <TooltipContent side="right" className="bg-card border-border">
                          <p>{item.label}</p>
                        </TooltipContent>
                      </Tooltip>
                    )
                  }

                  return <div key={item.label}>{notificationButton}</div>
                }
                return <NavLink key={item.label} item={item} />
              })}

              {/* Profile Link */}
              {isExpanded ? (
                <Link
                  to="/profile"
                  onClick={() => setIsNotificationOpen(false)}
                  className={cn(
                    'flex items-center gap-4 rounded-xl px-3 py-3 text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground',
                    isActive('/profile') && 'bg-accent text-foreground font-semibold'
                  )}
                >
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={user?.avatar} alt={user?.username} />
                    <AvatarFallback className="text-xs">
                      {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">Profile</span>
                </Link>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to="/profile"
                      onClick={() => setIsNotificationOpen(false)}
                      className={cn(
                        'flex items-center justify-center rounded-xl px-3 py-3 text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground w-12',
                        isActive('/profile') && 'bg-accent text-foreground font-semibold'
                      )}
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={user?.avatar} alt={user?.username} />
                        <AvatarFallback className="text-xs">
                          {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-card border-border">
                    <p>Profile</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </nav>
          </ScrollArea>

          {/* Bottom Section */}
          <div className="border-t border-border p-3">
            <DropdownMenu onOpenChange={setIsDropdownOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "h-auto hover:bg-accent rounded-xl",
                    isExpanded ? "w-full justify-start gap-4 px-3 py-3" : "w-12 p-3 justify-center"
                  )}
                >
                  <Menu className="h-6 w-6 shrink-0" />
                  <span className={cn(
                    "text-sm font-medium transition-all duration-200",
                    isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
                  )}>
                    More
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side="top"
                className="w-56 bg-card border-border"
              >
                <DropdownMenuItem 
                  className="gap-3 py-3 cursor-pointer"
                  onClick={() => onCollapsedChange?.(!collapsed)}
                >
                  {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                  <span>{collapsed ? 'Expand sidebar' : 'Collapse sidebar'}</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-3 py-3 cursor-pointer">
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-3 py-3 cursor-pointer">
                  <User className="h-4 w-4" />
                  <span>Your activity</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="gap-3 py-3 cursor-pointer text-destructive focus:text-destructive"
                  disabled={isLoggingOut}
                  onClick={() => logout()}
                >
                  <LogOut className="h-4 w-4" />
                  <span>{isLoggingOut ? 'Logging out...' : 'Log out'}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {/* Notification Panel */}
      <NotificationPanel 
        isOpen={isNotificationOpen} 
        onClose={() => setIsNotificationOpen(false)} 
      />
    </TooltipProvider>
  )
}

export default Sidebar
