import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  BookmarkCheck,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { openCommentDialog } from '@/store/commentSlice'
import { RootState } from '@/store/store'
import { useLikePostMutation, useAddCommentMutation, useSavePostMutation, useUnsavePostMutation } from '@/services/postApi'
import { formatPostTime } from '@/lib/date'

interface PostAuthor {
  _id: string
  username: string
  fullName?: string
  avatar: string
}

interface PostProps {
  postId: string
  userId: string
  postImage: string | string[]
  description: string
  likecount: string | number
  commentcount: string | number
  created: string
  onCommentClick: () => void
  author?: PostAuthor
  isLiked?: boolean
  isSaved?: boolean
  feedType?: 'following' | 'discover'
}

/**
 * Post Component
 *
 * Instagram-style post with:
 * - Sleek header with avatar and username
 * - High-quality image display
 * - Animated like, comment, share actions
 * - Interactive comment input
 * - Discover ("Suggested for you") badge
 */
const Post = ({
  postId,
  userId,
  postImage,
  description,
  likecount,
  commentcount,
  created,
  onCommentClick,
  author,
  isLiked: isLikedProp,
  isSaved: isSavedProp,
  feedType,
}: PostProps) => {
  const dispatch = useDispatch()
  const [commentText, setCommentText] = useState('')
  const [showFullCaption, setShowFullCaption] = useState(false)

  const [localLiked, setLocalLiked] = useState<boolean | null>(null)
  const [localLikeCount, setLocalLikeCount] = useState(Number(likecount) || 0)
  const [localSaved, setLocalSaved] = useState<boolean | null>(null)
  const [saveBusy, setSaveBusy] = useState(false)

  const currentUser = useSelector((state: RootState) => state.auth.user)

  const [likePost, { isLoading: isLiking }] = useLikePostMutation()
  const [addComment, { isLoading: isCommenting }] = useAddCommentMutation()
  const [savePost] = useSavePostMutation()
  const [unsavePost] = useUnsavePostMutation()

  useEffect(() => {
    if (isLikedProp !== undefined && localLiked === null) {
      setLocalLiked(isLikedProp)
    }
  }, [isLikedProp, localLiked])

  useEffect(() => {
    setLocalLikeCount(Number(likecount) || 0)
  }, [likecount])

  useEffect(() => {
    if (isSavedProp !== undefined && localSaved === null) {
      setLocalSaved(isSavedProp)
    } else if (isSavedProp !== undefined && !saveBusy) {
      setLocalSaved(isSavedProp)
    }
  }, [isSavedProp, localSaved, saveBusy])

  const user: PostAuthor = author
    ? {
        _id: author._id,
        username: author.username,
        fullName: author.fullName,
        avatar: author.avatar,
      }
    : {
        _id: typeof userId === 'string' ? userId : (userId as any)?._id ?? userId,
        username: '',
        avatar: '',
      }
  const isLiked = localLiked ?? isLikedProp ?? false
  const isSaved = localSaved ?? isSavedProp ?? false
  const timeAgo = formatPostTime(created)
  const imageUrl = Array.isArray(postImage) ? postImage[0] : postImage

  const shouldTruncate = description && description.length > 100
  const displayCaption = shouldTruncate && !showFullCaption
    ? `${description.slice(0, 100)}...`
    : description

  const handleLike = async () => {
    if (isLiking) return

    const wasLiked = isLiked
    setLocalLiked(!wasLiked)
    setLocalLikeCount(prev => wasLiked ? prev - 1 : prev + 1)

    try {
      await likePost(postId).unwrap()
    } catch (error) {
      setLocalLiked(wasLiked)
      setLocalLikeCount(prev => wasLiked ? prev + 1 : prev - 1)
      console.error('Failed to like post:', error)
    }
  }

  const handleDoubleClickLike = async () => {
    if (!isLiked) {
      await handleLike()
    }
  }

  const handleComment = async () => {
    if (!commentText.trim() || isCommenting) return
    try {
      await addComment({ postId, text: commentText }).unwrap()
      setCommentText('')
    } catch (error) {
      console.error('Failed to add comment:', error)
    }
  }

  const handleBookmark = async () => {
    if (saveBusy) return
    const wasSaved = isSaved
    const nextSaved = !wasSaved
    setLocalSaved(nextSaved)
    setSaveBusy(true)
    try {
      if (nextSaved) {
        await savePost(postId).unwrap()
      } else {
        await unsavePost(postId).unwrap()
      }
    } catch (error) {
      setLocalSaved(wasSaved)
      console.error('Failed to update saved state:', error)
    } finally {
      setSaveBusy(false)
    }
  }

  const handleCommentClick = () => {
    dispatch(openCommentDialog())
    onCommentClick()
  }

  return (
    <div className="space-y-2">
      {feedType === 'discover' && (
        <div className="flex items-center gap-1.5 px-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary/70" />
          <span>Suggested for you</span>
        </div>
      )}
      <article className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <Link to={`/user/${user._id}`} className="relative">
            <div className="p-[2px] rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500">
              <Avatar className="h-9 w-9 ring-2 ring-background">
                <AvatarImage src={user.avatar} alt={user.username} />
                <AvatarFallback className="bg-muted text-sm">
                  {user.username?.charAt(0)?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          </Link>
          <div className="flex flex-col">
            <Link 
              to={`/user/${user._id}`}
              className="text-sm font-semibold text-foreground hover:opacity-70 transition-opacity"
            >
              {user.username}
            </Link>
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-accent">
              <MoreHorizontal className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52 bg-card border-border">
            <DropdownMenuItem className="cursor-pointer py-3">
              Report
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer py-3">
              <Link to={`/post/${postId}`} className="w-full">Go to post</Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer py-3">
              Share to...
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer py-3">
              Copy link
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem className="cursor-pointer py-3 text-destructive focus:text-destructive">
              Unfollow
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Image - Double click to like */}
      <div 
        className="relative w-full bg-black cursor-pointer select-none"
        onDoubleClick={handleDoubleClickLike}
      >
        <img
          src={imageUrl}
          alt="Post"
          className="w-full object-contain max-h-[70vh]"
          loading="lazy"
        />
      </div>

      {/* Actions */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 hover:bg-transparent hover:opacity-60 transition-all"
              onClick={handleLike}
              disabled={isLiking}
            >
              <Heart
                className={cn(
                  'h-[26px] w-[26px] transition-all duration-200',
                  isLiked 
                    ? 'fill-red-500 text-red-500 scale-110' 
                    : 'text-foreground hover:text-muted-foreground'
                )}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 hover:bg-transparent hover:opacity-60 transition-opacity"
              onClick={handleCommentClick}
            >
              <MessageCircle className="h-[26px] w-[26px]" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-10 w-10 hover:bg-transparent hover:opacity-60 transition-opacity"
            >
              <Send className="h-[24px] w-[24px]" />
            </Button>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 hover:bg-transparent hover:opacity-60 transition-all"
            onClick={handleBookmark}
            disabled={saveBusy}
          >
            {isSaved ? (
              <BookmarkCheck className="h-[26px] w-[26px] fill-foreground" />
            ) : (
              <Bookmark className="h-[26px] w-[26px]" />
            )}
          </Button>
        </div>

        {/* Likes */}
        <p className="text-sm font-semibold text-foreground mb-2">
          {localLikeCount.toLocaleString()} {localLikeCount === 1 ? 'like' : 'likes'}
        </p>

        {/* Caption */}
        {description && (
          <div className="text-sm text-foreground mb-1">
            <Link
              to={`/user/${user._id}`}
              className="font-semibold hover:opacity-70 transition-opacity mr-2"
            >
              {user.username}
            </Link>
            <span className="text-foreground/90">{displayCaption}</span>
            {shouldTruncate && !showFullCaption && (
              <button 
                onClick={() => setShowFullCaption(true)}
                className="text-muted-foreground hover:text-foreground ml-1"
              >
                more
              </button>
            )}
          </div>
        )}

        {/* View Comments */}
        {Number(commentcount) > 0 && (
          <button
            onClick={handleCommentClick}
            className="text-sm text-muted-foreground hover:text-muted-foreground/70 transition-opacity block mb-1"
          >
            View all {commentcount} comments
          </button>
        )}

        {/* Timestamp for mobile */}
        <time className="text-[10px] text-muted-foreground uppercase tracking-wide">
          {timeAgo}
        </time>
      </div>

      {/* Add Comment */}
      <div   className="
        sticky
        bottom-0
        z-10
        flex
        items-center
        gap-3
        px-4
        py-3
        border-t
        border-border
        bg-card
    ">
        <Avatar className="h-7 w-7">
          <AvatarImage src={currentUser?.avatar} alt="You" />
          <AvatarFallback className="text-xs">
            {currentUser?.username?.charAt(0)?.toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
        <Input
          placeholder="Add a comment..."
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleComment()}
          className="
          pl-1
flex-1
border-0
bg-transparent
shadow-none
outline-none
ring-0
focus-visible:ring-0
focus-visible:ring-offset-0
focus:border-0
focus:outline-none
h-auto
text-sm
placeholder:text-muted-foreground
"
        />
        {commentText.trim() && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleComment}
            disabled={isCommenting}
            className="text-primary font-semibold h-auto p-0 hover:bg-transparent hover:text-primary/70"
          >
            Post
          </Button>
        )}
      </div>
    </article>
    </div>
  )
}

/**
 * PostSkeleton Component
 * Loading placeholder for Post
 */
export const PostSkeleton = () => {
  return (
    <article className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header Skeleton */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Skeleton className="h-9 w-9 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-2.5 w-16" />
        </div>
      </div>

      {/* Image Skeleton */}
      <Skeleton className="aspect-square w-full" />

      {/* Actions Skeleton */}
      <div className="px-4 py-3 space-y-3">
        <div className="flex gap-3">
          <Skeleton className="h-7 w-7 rounded-full" />
          <Skeleton className="h-7 w-7 rounded-full" />
          <Skeleton className="h-7 w-7 rounded-full" />
        </div>
        <Skeleton className="h-3.5 w-24" />
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </div>
    </article>
  )
}

export default Post
