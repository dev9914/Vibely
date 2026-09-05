import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { Loader2 } from 'lucide-react'
import { RootState } from '@/store/store'
import { NewPostsBanner, Post, PostSkeleton, StoriesBar, Suggestions } from '@/components/feed'
import { CommentDialog } from '@/components/CommentDialog'
import { CardWithForm } from '@/components/Card'
import { StoryViewer } from '@/components/story'
import { useNewPostsAvailable } from '@/hooks/useNewPostsAvailable'
import {
  useGetAllPostsQuery,
  useGetAllUsersQuery,
  useGetPostByIdQuery,
  useCreateStoryMutation,
  type StoryGroup,
} from '@/services'

interface HomeProps {
  user: {
    _id: string
    username: string
    avatar: string
    fullName?: string
  }
}

const scrollToTopSmooth = () =>
  new Promise<void>((resolve) => {
    const root = document.scrollingElement ?? document.body
    if (!root) {
      resolve()
      return
    }
    const startTop = root.scrollTop
    if (startTop <= 1) {
      resolve()
      return
    }
    let raf = 0
    const startTime = performance.now()
    const duration = 420
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration)
      root.scrollTop = Math.round(startTop * (1 - easeOutCubic(t)))
      if (t < 1 && root.scrollTop > 0) {
        raf = requestAnimationFrame(tick)
      } else {
        root.scrollTop = 0
        resolve()
      }
    }
    raf = requestAnimationFrame(tick)
  })

/**
 * Home Page
 *
 * Main feed view with:
 * - Stories bar at top
 * - Post feed (center)
 * - Suggestions sidebar (right)
 * - New Posts Available banner with periodic polling
 */
const Home = ({ user }: HomeProps) => {
  const [postId, setPostId] = useState('')
  const [page, setPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const storyFileInputRef = useRef<HTMLInputElement | null>(null)

  const [storyViewerOpen, setStoryViewerOpen] = useState(false)
  const [viewerStartGroup, setViewerStartGroup] = useState(0)
  const [viewerStartStory, setViewerStartStory] = useState(0)
  const [viewerGroups, setViewerGroups] = useState<StoryGroup[]>([])

  const observerRef = useRef<IntersectionObserver | null>(null)
  const lastObservedElementRef = useRef<Element | null>(null)
  const hasMoreRef = useRef(true)
  const isFetchingRef = useRef(false)
  const loadingMoreRef = useRef(false)
  const resettingRef = useRef(false)

  // Redux state
const createPostOpen = useSelector(
  (state: RootState) => state.ui.isCreatePostModalOpen
)
const commentOpen = useSelector(
  (state: RootState) => state.comment.isCommentDialogOpen
)

  // RTK Query hooks
  const {
    data: postsData,
    isLoading: postsLoading,
    isFetching: postsFetching,
  } = useGetAllPostsQuery({ page })

  const { data: usersData, isLoading: usersLoading } = useGetAllUsersQuery()
  const { data: postDetailsData } = useGetPostByIdQuery(postId, { skip: !postId })
  const [createStory, { isLoading: creatingStory }] = useCreateStoryMutation()

  // Computed values
  const allPosts = postsData?.posts || []
  const hasMore = postsData?.hasMore ?? true
  const currentPage = postsData?.currentPage ?? 1
  const isLoadingMore = postsFetching && page > 1
  const allUsers = usersData?.users || []
  const comments = postDetailsData?.post?.comments || []

  const firstPostId = useMemo(() => allPosts[0]?._id ?? null, [allPosts])
  const currentTotal =
    (postsData?.totalPages ?? 0) > 0
      ? Math.min(
          allPosts.length,
          currentPage * (postsData?.posts?.length ?? 10),
        )
      : allPosts.length

  const {
    showBanner,
    newCount,
    isAtTop,
    dismissBanner,
    acknowledge,
  } = useNewPostsAvailable({
    currentFirstPostId: firstPostId,
    currentTotalPosts: currentTotal,
    enabled: !createPostOpen && !commentOpen,
  })

  const handleBannerClick = useCallback(async () => {
    if (resettingRef.current) return
    resettingRef.current = true
    try {
      await scrollToTopSmooth()
      setPage(1)
    } finally {
      acknowledge()
      resettingRef.current = false
    }
  }, [acknowledge])

  useEffect(() => {
    if (isAtTop && page !== 1 && !postsFetching) {
      setPage(1)
    }
  }, [isAtTop, page, postsFetching])

  // Filter out current user from stories and suggestions
  const storyUsers = allUsers.filter((u: any) => u._id !== user._id).slice(0, 8)
  const suggestionUsers = allUsers.filter((u: any) => u._id !== user._id).slice(0, 5)
  const viewerOpen = storyViewerOpen || createPostOpen || commentOpen || creatingStory

  // Handle body scroll when modals are open
  useEffect(() => {
    if (viewerOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [viewerOpen])

  useEffect(() => {
    hasMoreRef.current = hasMore
  }, [hasMore])

  useEffect(() => {
    isFetchingRef.current = postsFetching
  }, [postsFetching])

  useEffect(() => {
    loadingMoreRef.current = loadingMore
  }, [loadingMore])

  useEffect(() => {
    if (!postsFetching) {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [postsFetching])

  // Single observer instance for infinite scroll prefetch
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const firstEntry = entries[0]

        if (!firstEntry?.isIntersecting) {
          return
        }

        if (
          isFetchingRef.current ||
          !hasMoreRef.current ||
          loadingMoreRef.current
        ) {
          return
        }

        // Lock immediately to avoid duplicate page increments before state updates flush.
        loadingMoreRef.current = true
        setLoadingMore(true)
        setPage((prev) => prev + 1)
      },
      {
        root: null,
        rootMargin: '400px',
        threshold: 0,
      }
    )

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
      observerRef.current = null
      lastObservedElementRef.current = null
    }
  }, [])

  const setLastPostRef = useCallback((node: HTMLDivElement | null) => {
    const observer = observerRef.current
    if (!observer) {
      return
    }

    if (lastObservedElementRef.current) {
      observer.unobserve(lastObservedElementRef.current)
    }

    if (node) {
      observer.observe(node)
      lastObservedElementRef.current = node
      return
    }

    lastObservedElementRef.current = null
  }, [])

  const handleCommentClick = (id: string) => {
    setPostId(id)
  }

  const handleOpenStoryViewer = useCallback(
    (payload: {
      groups: StoryGroup[]
      startGroupIndex: number
      startStoryIndex: number
    }) => {
      setViewerGroups(payload.groups)
      setViewerStartGroup(payload.startGroupIndex)
      setViewerStartStory(payload.startStoryIndex)
      setStoryViewerOpen(true)
    },
    [],
  )

  const handleOpenCreateStory = useCallback(() => {
    storyFileInputRef.current?.click()
  }, [])

  const handleStoryFilesSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : []
      if (!files.length) return
      const formData = new FormData()
      for (const file of files) {
        if (file.type.startsWith('video/')) {
          formData.append('video', file)
        } else if (file.type.startsWith('image/')) {
          formData.append('image', file)
        }
      }
      try {
        await createStory(formData).unwrap()
      } catch {
        // RTK Query / middleware handles toasts; swallow here
      } finally {
        e.target.value = ''
      }
    },
    [createStory],
  )

  return (
    <div className="min-h-screen bg-background">
      {/* New Posts Available banner */}
      <NewPostsBanner
        visible={showBanner}
        count={newCount}
        onClick={handleBannerClick}
        onDismiss={dismissBanner}
      />

      {/* Dialogs */}
      {createPostOpen && <CardWithForm />}
      {commentOpen && (
        <CommentDialog
          comments={comments}
          postId={postId}
        />
      )}

      {/* Story Viewer Modal */}
      <StoryViewer
        open={storyViewerOpen}
        onClose={() => setStoryViewerOpen(false)}
        groups={viewerGroups}
        startGroupIndex={viewerStartGroup}
        startStoryIndex={viewerStartStory}
        currentUserId={user._id}
      />

      {/* Hidden file input for creating story (multiple = batch multiple stories) */}
      <input
        ref={storyFileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={handleStoryFilesSelected}
      />

      {/* Main Layout - Instagram-style centered layout */}
      <div className="flex justify-center w-full">
        <div className="flex w-full max-w-[935px] gap-8 pt-4">
          {/* Feed Section */}
          <div className="flex-1 max-w-[630px] min-w-0">
            {/* Stories */}
            <StoriesBar
              users={storyUsers}
              currentUser={user}
              isLoading={usersLoading}
              onOpenViewer={handleOpenStoryViewer}
              onOpenCreate={handleOpenCreateStory}
            />

            {/* Posts Feed */}
            <div className="space-y-5 py-4">
              {/* Loading State */}
              {allPosts.length === 0 && (postsLoading || postsFetching) ? (
                <div className="space-y-6">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <PostSkeleton key={i} />
                  ))}
                </div>
              ) : allPosts.length === 0 ? (
                /* Empty State */
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="mb-4 rounded-full bg-muted p-6">
                    <svg
                      className="h-12 w-12 text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    No posts yet
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Follow some people to see their posts here.
                  </p>
                </div>
              ) : (
                /* Posts List */
                <>
                  {allPosts.map((post: any, index: number) => {
                    const isLastPost = index === allPosts.length - 1

                    return (
                      <div
                        key={post._id}
                        ref={isLastPost ? setLastPostRef : null}
                      >
                        <Post
                          postId={post._id}
                          userId={typeof post.userId === 'object' ? (post.userId as any)._id : post.userId}
                          postImage={post.postImage || post.image}
                          description={post.description || post.caption}
                          likecount={post.likecount || post.likes?.length || 0}
                          commentcount={post.commentcount || post.comments?.length || 0}
                          created={post.createdAt}
                          onCommentClick={() => handleCommentClick(post._id)}
                          author={post.author}
                          isLiked={post.isLiked}
                          isSaved={post.isSaved}
                          feedType={post.feedType}
                        />
                      </div>
                    )
                  })}

                  {/* Loading more indicator */}
                  {(loadingMore || isLoadingMore || (postsFetching && currentPage > 1)) && (
                    <div className="py-4 flex justify-center">
                      <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading more posts...
                      </div>
                    </div>
                  )}

                  {/* End of feed */}
                  {!hasMore && allPosts.length > 0 && (
                    <div className="py-8 text-center">
                      <p className="text-sm text-muted-foreground">
                        You've seen all posts
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right Sidebar - Suggestions (hidden on smaller screens) */}
          <div className="hidden lg:block w-[293px] shrink-0">
            <div className="sticky top-4 overflow-y-auto max-h-[calc(100vh-2rem)]">
              <Suggestions
                currentUser={user}
                suggestions={suggestionUsers}
                isLoading={usersLoading}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
