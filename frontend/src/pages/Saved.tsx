import { useState, useEffect, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { Heart, MessageCircle, Bookmark, BookmarkX, Grid3X3 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useGetMySavedPostsQuery, useUnsavePostMutation } from '@/services/postApi'

const PAGE_SIZE = 30

interface SavedGridItemProps {
  post: {
    _id: string
    postImage: string[]
    likes?: string[]
    comments?: string[]
    likecount?: number | string
    commentcount?: number | string
  }
  onUnsave: () => void
  unsaving: boolean
}

const SavedGridItem = ({ post, onUnsave, unsaving }: SavedGridItemProps) => {
  const imageUrl = Array.isArray(post.postImage) ? post.postImage[0] : post.postImage
  const likeCount = post.likes?.length ?? Number(post.likecount) ?? 0
  const commentCount = post.comments?.length ?? Number(post.commentcount) ?? 0

  return (
    <Link
      to={`/post/${post._id}`}
      className="group relative overflow-hidden bg-muted aspect-square"
    >
      <img
        src={imageUrl}
        alt="Saved post"
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6">
        <div className="flex items-center gap-2 text-white font-semibold">
          <Heart className="w-5 h-5 fill-white" />
          <span>{likeCount}</span>
        </div>
        <div className="flex items-center gap-2 text-white font-semibold">
          <MessageCircle className="w-5 h-5 fill-white" />
          <span>{commentCount}</span>
        </div>
      </div>
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onUnsave()
        }}
        disabled={unsaving}
        className={cn(
          "absolute top-2 right-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full",
          "bg-black/50 text-white backdrop-blur-sm transition-opacity",
          "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
          "hover:bg-black/70 disabled:opacity-50",
        )}
        aria-label="Remove from saved"
      >
        {unsaving ? (
          <BookmarkX className="h-4 w-4" />
        ) : (
          <Bookmark className="h-4 w-4 fill-white" />
        )}
      </button>
    </Link>
  )
}

const SavedGridSkeleton = () => (
  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-1 md:gap-[3px]">
    {Array.from({ length: 9 }).map((_, i) => (
      <Skeleton key={i} className="aspect-square w-full bg-muted" />
    ))}
  </div>
)

const EmptySavedState = () => (
  <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
    <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full border-2 border-foreground">
      <Bookmark className="h-10 w-10" />
    </div>
    <h2 className="mb-2 text-2xl font-semibold tracking-tight">Only you can see what you've saved</h2>
    <p className="max-w-md text-muted-foreground">
      Save photos and videos that you want to see again. No one is notified, and only you can see what you've saved.
    </p>
  </div>
)

const Saved = () => {
  const navigate = useNavigate()
  const [page, setPage] = useState(1)
  const [unsavingId, setUnsavingId] = useState<string | null>(null)

  const { data, isLoading, isFetching } =
    useGetMySavedPostsQuery(
      { page, limit: PAGE_SIZE },
      { refetchOnMountOrArgChange: true },
    )

  const [unsavePost] = useUnsavePostMutation()

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const hasMore = data?.hasMore ?? false
  const isFetchingNextPage = isFetching && page > 1 && !isLoading

  useEffect(() => {
    if (!sentinelRef.current || !hasMore) return
    const el = sentinelRef.current
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage && hasMore) {
          setPage((p) => p + 1)
        }
      },
      { rootMargin: '400px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, isFetchingNextPage])

  const mergedPosts = useMemo(() => {
    if (!data?.posts) return []
    const seen = new Set<string>()
    return data.posts.filter((p) => {
      if (seen.has(p._id)) return false
      seen.add(p._id)
      return true
    })
  }, [data?.posts])

  const handleUnsave = async (postId: string) => {
    setUnsavingId(postId)
    try {
      await unsavePost(postId).unwrap()
    } finally {
      setUnsavingId(null)
    }
  }

  const showEmpty = !isLoading && !isFetching && mergedPosts.length === 0

  return (
    <div ref={scrollRef} className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-[975px] px-4 pb-16 pt-10 sm:px-6">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Grid3X3 className="h-6 w-6" />
            <h1 className="text-2xl font-semibold tracking-tight">Saved</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => navigate('/')}
          >
            Back to feed
          </Button>
        </header>

        {/* Subtle count */}
        {!showEmpty && (
          <div className="mb-3 text-xs uppercase tracking-wider text-muted-foreground">
            {mergedPosts.length} {mergedPosts.length === 1 ? 'post' : 'posts'}
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <SavedGridSkeleton />
        ) : showEmpty ? (
          <EmptySavedState />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-1 md:gap-[3px]">
              {mergedPosts.map((post) => (
                <SavedGridItem
                  key={post._id}
                  post={post}
                  unsaving={unsavingId === post._id}
                  onUnsave={() => handleUnsave(post._id)}
                />
              ))}
            </div>

            {/* Pagination sentinel */}
            <div ref={sentinelRef} className="py-10 flex justify-center">
              {isFetchingNextPage && (
                <div className="grid grid-cols-3 gap-1 md:gap-[3px] w-full">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-square w-full bg-muted" />
                  ))}
                </div>
              )}
              {!hasMore && mergedPosts.length > 0 && !isFetchingNextPage && (
                <p className="text-xs text-muted-foreground">You're all caught up.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default Saved
