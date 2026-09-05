import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Plus, Upload as UploadIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useGetStoriesFeedQuery, type StoryGroup } from '@/services/storyApi'

interface StoryUserShim {
  _id: string
  username: string
  avatar: string
  fullName?: string
}

interface StoriesBarProps {
  users?: StoryUserShim[]
  currentUser?: StoryUserShim
  isLoading?: boolean
  onOpenViewer?: (args: {
    groups: StoryGroup[]
    startGroupIndex: number
    startStoryIndex: number
  }) => void
  onOpenCreate?: () => void
}

const StoriesBar = ({
  onOpenViewer,
  onOpenCreate,
  isLoading: loadingProp,
  users: _users,
  currentUser,
}: StoriesBarProps) => {
  const { data, isLoading, isFetching } = useGetStoriesFeedQuery(undefined, {
    refetchOnMountOrArgChange: true,
    pollingInterval: 60_000,
  })

  const loading = loadingProp || isLoading
  const feedGroups = data?.groups ?? []
  const mine = data?.mine ?? null
  const currentUserId = data?.currentUserId ?? currentUser?._id ?? ''

  const mergedGroups: StoryGroup[] = useMemo(() => {
    const order: string[] = []
    const map = new Map<string, StoryGroup>()
    const push = (g: StoryGroup | null) => {
      if (!g) return
      const k = String(g.user._id)
      if (!map.has(k)) {
        map.set(k, g)
        order.push(k)
      }
    }
    push(mine)
    for (const g of feedGroups) push(g)
    return order.map((k) => map.get(k)!).filter(Boolean)
  }, [mine, feedGroups])

  const mineHasStories = !!mine && mine.stories.length > 0

  const open = (gi: number, si = 0) => {
    if (!onOpenViewer) return
    onOpenViewer({ groups: mergedGroups, startGroupIndex: gi, startStoryIndex: si })
  }

  if (loading) {
    return <StoriesBarSkeleton />
  }

  return (
    <div className="w-full bg-card/50 rounded-lg border border-border/50 py-4 mb-4 relative">
      {isFetching && !loading ? (
        <div className="absolute left-4 top-2 h-0.5 w-12 overflow-hidden rounded-full bg-muted">
          <div className="animate-pulse h-full w-6 bg-primary" />
        </div>
      ) : null}
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-4 px-4">
          {/* Current user / Your Story */}
          <CurrentUserAvatar
            currentUser={currentUser}
            mine={mine}
            mineHasStories={mineHasStories}
            onCreate={() => onOpenCreate?.()}
            onOpen={() => {
              const idx = mergedGroups.findIndex(
                (g) => String(g.user._id) === String(currentUserId),
              )
              if (idx >= 0) open(idx, 0)
              else onOpenCreate?.()
            }}
          />

          {mergedGroups
            .filter((g) => String(g.user._id) !== String(currentUserId))
            .map((g, i) => {
              const realGroupIndex = mergedGroups.indexOf(g)
              return (
                <StoryAvatar
                  key={g.user._id}
                  group={g}
                  onClick={() => open(realGroupIndex, 0)}
                />
              )
            })}
        </div>
        <ScrollBar orientation="horizontal" className="invisible" />
      </ScrollArea>
    </div>
  )
}

interface CurrentUserAvatarProps {
  currentUser?: StoryUserShim
  mine: StoryGroup | null
  mineHasStories: boolean
  onCreate: () => void
  onOpen: () => void
}

const CurrentUserAvatar = ({
  currentUser,
  mine,
  mineHasStories,
  onCreate,
  onOpen,
}: CurrentUserAvatarProps) => {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)

  const avatarUser: StoryUserShim = mine?.user && (mine.user as any).avatar
    ? (mine.user as any)
    : currentUser || { _id: '', username: '', avatar: '' }

  if (!avatarUser || !avatarUser._id) return null

  const hasUnseen = mine?.hasUnseen ?? false

  return (
    <div className="flex flex-col items-center gap-1 group">
      <button
        type="button"
        onClick={() => {
          if (mineHasStories) {
            onOpen()
          } else {
            onCreate()
            fileRef.current?.click()
          }
        }}
        className="flex flex-col items-center gap-1"
      >
        <div className="relative">
          <div
            className={cn(
              'rounded-full p-[2px]',
              mineHasStories && hasUnseen
                ? 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600'
                : mineHasStories
                ? 'bg-muted-foreground/40'
                : 'bg-transparent',
            )}
          >
            <div className="rounded-full bg-background p-[2px]">
              <Avatar className="h-14 w-14">
                <AvatarImage src={avatarUser.avatar} alt={avatarUser.username} />
                <AvatarFallback className="bg-muted text-lg">
                  {avatarUser.username?.charAt(0)?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>

          <div className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-primary">
            <Plus className="h-3 w-3 text-primary-foreground" />
          </div>
        </div>
        <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors max-w-[64px] truncate">
          {mineHasStories ? 'Your story' : 'Your story'}
        </span>
      </button>

      {/* Hidden upload picker wired to Create story dialog */}
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        // onChange handled by Create Story dialog integration via uiSlice.openCreatePostModal pattern
        // see Home.tsx — we trigger onCreate() which will drive the dialog.
        disabled={uploading}
      />
    </div>
  )
}

interface StoryAvatarProps {
  group: StoryGroup
  onClick: () => void
}

const StoryAvatar = ({ group, onClick }: StoryAvatarProps) => {
  const u = group.user
  const username = u?.username || ''
  const hasAny = group.stories.length > 0
  const hasUnseen = group.hasUnseen

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!hasAny}
      className="flex flex-col items-center gap-1 group disabled:opacity-60"
    >
      <div className="relative">
        <div
          className={cn(
            'rounded-full p-[2px]',
            hasAny && hasUnseen
              ? 'bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600'
              : hasAny
              ? 'bg-muted-foreground/40'
              : 'bg-transparent',
          )}
        >
          <div className="rounded-full bg-background p-[2px]">
            <Avatar className="h-14 w-14">
              <AvatarImage src={u.avatar} alt={username} />
              <AvatarFallback className="bg-muted text-lg">
                {username?.charAt(0)?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>
      </div>
      <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors max-w-[64px] truncate">
        {username || 'user'}
      </span>
    </button>
  )
}

const StoriesBarSkeleton = () => {
  return (
    <div className="w-full bg-card/50 rounded-lg border border-border/50 py-4 mb-4">
      <div className="flex gap-4 px-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <Skeleton className="h-[60px] w-[60px] rounded-full" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default StoriesBar
