import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { X as XIcon, ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon, Pause, Play } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import {
  useMarkStoryViewedMutation,
  type StoryGroup,
  type StoryItem,
} from '@/services/storyApi'

const IMAGE_DURATION_MS = 5000
const VIDEO_DURATION_MS = 15000
const FRAME_MS = 16

export interface StoryViewerProps {
  open: boolean
  onClose: () => void
  groups: StoryGroup[]
  startGroupIndex?: number
  startStoryIndex?: number
  currentUserId: string
}

const AvatarUI = ({ user }: { user: StoryItem['user'] }) => {
  const avatar = user?.avatar || ''
  const username = user?.username || ''
  const initial = username?.charAt(0)?.toUpperCase() || '?'
  return (
    <div className="h-8 w-8 shrink-0">
      <Avatar className="h-8 w-8 ring-1 ring-white/20">
        {avatar ? <AvatarImage src={avatar} alt={username} /> : null}
        <AvatarFallback className="bg-muted text-xs text-foreground">{initial}</AvatarFallback>
      </Avatar>
    </div>
  )
}

const formatStoryTime = (createdAtIso: string) => {
  try {
    const then = new Date(createdAtIso).getTime()
    const now = Date.now()
    const diff = Math.max(0, now - then)
    const sec = Math.floor(diff / 1000)
    if (sec < 60) return `${sec}s`
    const min = Math.floor(sec / 60)
    if (min < 60) return `${min}m`
    const hr = Math.floor(min / 60)
    if (hr < 24) return `${hr}h`
    return `${Math.floor(hr / 24)}d`
  } catch {
    return ''
  }
}

type PointerHolding = { startAt: number; isLong: boolean; ended: boolean } | null

export default function StoryViewer({
  open,
  onClose,
  groups: groupsProp,
  startGroupIndex = 0,
  startStoryIndex = 0,
  currentUserId,
}: StoryViewerProps) {
  const groups = groupsProp
  const flat = useMemo(() => {
    const out: Array<{
      groupIndex: number
      storyIndex: number
      story: StoryItem
    }> = []
    for (let gi = 0; gi < groups.length; gi++) {
      for (let si = 0; si < groups[gi].stories.length; si++) {
        out.push({ groupIndex: gi, storyIndex: si, story: groups[gi].stories[si] })
      }
    }
    return out
  }, [groups])

  const findStartFlat = useCallback(() => {
    if (!flat.length) return -1
    const candidate = flat.findIndex(
      (f) => f.groupIndex === startGroupIndex && f.storyIndex === startStoryIndex,
    )
    return candidate >= 0 ? candidate : 0
  }, [flat, startGroupIndex, startStoryIndex])

  const [flatIndex, setFlatIndex] = useState<number>(() => findStartFlat())
  useEffect(() => {
    setFlatIndex(findStartFlat())
  }, [findStartFlat])

  const pos = flat[flatIndex]
  const group = pos ? groups[pos.groupIndex] : null
  const story = pos?.story

  const progressRef = useRef<number>(0)
  const rafRef = useRef<number | null>(null)
  const lastFrameRef = useRef<number>(0)
  const [progress, setProgress] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const holdingRef = useRef<PointerHolding>(null)
  const touchStartXRef = useRef<number | null>(null)
  const touchStartYRef = useRef<number | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const videoDurationRef = useRef<number>(VIDEO_DURATION_MS)
  const videoPlayingRef = useRef(false)
  const videoMarkedEndedRef = useRef<string | null>(null)
  const [markViewed, { isLoading: markingViewed }] = useMarkStoryViewedMutation()
  const lastMarkedViewedRef = useRef<Set<string>>(new Set())
  const preloadedRef = useRef<Set<string>>(new Set())

  const goPrev = useCallback(() => {
    progressRef.current = 0
    setProgress(0)
    setFlatIndex((i) => Math.max(0, i - 1))
  }, [])

  const goNext = useCallback(() => {
    progressRef.current = 0
    setProgress(0)
    setFlatIndex((i) => {
      const next = i + 1
      if (next >= flat.length) {
        // last story ends → auto close
        onClose()
        return i
      }
      return next
    })
  }, [flat.length, onClose])

  const markSeen = useCallback(
    async (id: string) => {
      if (!id) return
      if (lastMarkedViewedRef.current.has(id)) return
      lastMarkedViewedRef.current.add(id)
      try {
        if (!markingViewed) {
          await markViewed(id).unwrap()
        } else {
          void markViewed(id)
        }
      } catch {
        lastMarkedViewedRef.current.delete(id)
      }
    },
    [markViewed, markingViewed],
  )

  const preloadNextMedia = useCallback(() => {
    if (!flat.length) return
    const candidates: number[] = []
    if (flatIndex + 1 < flat.length) candidates.push(flatIndex + 1)
    if (flatIndex + 2 < flat.length) candidates.push(flatIndex + 2)
    for (const idx of candidates) {
      const s = flat[idx]?.story
      if (!s) continue
      if (preloadedRef.current.has(s._id)) continue
      preloadedRef.current.add(s._id)
      if (s.media.mediaType === 'image') {
        const img = new Image()
        img.src = s.media.url
      } else if (s.media.mediaType === 'video') {
        const v = document.createElement('video')
        v.preload = 'auto'
        v.src = s.media.url
      }
    }
  }, [flat, flatIndex])

  useEffect(() => {
    if (!open) return
    if (!story) return
    markSeen(story._id)
    preloadNextMedia()
    progressRef.current = 0
    setProgress(0)
    lastFrameRef.current = 0
    videoMarkedEndedRef.current = null
    if (story.media.mediaType === 'video') {
      videoDurationRef.current = VIDEO_DURATION_MS
      videoPlayingRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, story?._id])

  const tick = useCallback(() => {
    if (!story) return
    if (isPaused) {
      lastFrameRef.current = 0
      rafRef.current = requestAnimationFrame(tick)
      return
    }
    const now = performance.now()
    if (!lastFrameRef.current) lastFrameRef.current = now
    const dt = Math.min(100, now - lastFrameRef.current)
    lastFrameRef.current = now

    let duration: number
    if (story.media.mediaType === 'video') {
      duration = videoDurationRef.current
      if (videoRef.current && videoRef.current.duration > 1 && isFinite(videoRef.current.duration)) {
        duration = videoRef.current.duration * 1000
        videoDurationRef.current = duration
      }
      if (!videoPlayingRef.current && videoRef.current) {
        try {
          const p = videoRef.current.play()
          if (p && typeof p.then === 'function') {
            p.catch(() => {})
          }
          videoPlayingRef.current = true
        } catch {
          // ignore autoplay restrictions
        }
      }
    } else {
      duration = IMAGE_DURATION_MS
    }

    progressRef.current = Math.min(duration, progressRef.current + dt)
    const pct = duration > 0 ? progressRef.current / duration : 0
    setProgress(pct)

    if (progressRef.current >= duration) {
      if (story.media.mediaType === 'video' && videoRef.current && !videoRef.current.ended) {
        // wait for real video end
        if (videoMarkedEndedRef.current !== story._id) {
          videoMarkedEndedRef.current = story._id
          videoRef.current.addEventListener(
            'ended',
            () => {
              goNext()
            },
            { once: true },
          )
        }
      } else {
        goNext()
        return
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [story, isPaused, goNext])

  useEffect(() => {
    if (!open || !story) return
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      lastFrameRef.current = 0
      if (videoRef.current) {
        try {
          videoRef.current.pause()
        } catch {
          // ignore
        }
      }
      videoPlayingRef.current = false
    }
  }, [open, story?._id, tick])

  // Keyboard arrows + Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'ArrowRight') goNext()
      else if (e.key === ' ') {
        e.preventDefault()
        setIsPaused((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, goPrev, goNext, onClose])

  const onPointerDown = (e: React.PointerEvent) => {
    holdingRef.current = { startAt: performance.now(), isLong: false, ended: false }
    setIsPaused(true)
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    touchStartXRef.current = e.clientX
    touchStartYRef.current = e.clientY
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!holdingRef.current) return
    const heldMs = performance.now() - holdingRef.current.startAt
    if (heldMs > 220) holdingRef.current.isLong = true
    if (touchStartXRef.current === null) return
    const dx = e.clientX - touchStartXRef.current
    const dy = e.clientY - touchStartYRef.current
    // close-swipe-down gesture
    if (dy > 140 && Math.abs(dy) > Math.abs(dx) * 1.2) {
      onClose()
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const hold = holdingRef.current
    holdingRef.current = null
    setIsPaused(false)

    const sx = touchStartXRef.current
    const sy = touchStartYRef.current
    touchStartXRef.current = null
    touchStartYRef.current = null
    if (sx === null || sy === null) return

    const dx = e.clientX - sx
    const dy = e.clientY - sy
    const adx = Math.abs(dx)
    const ady = Math.abs(dy)

    if (hold && hold.isLong) return
    if (adx < 12 && ady < 12) {
      // tap: left third = previous, right third = next, middle = pause toggle (ignored for Instagram style tap zones)
      const rect = (e.currentTarget as Element).getBoundingClientRect()
      const relativeX = e.clientX - rect.left
      const zone = relativeX / rect.width
      if (zone < 0.33) goPrev()
      else goNext()
      return
    }
    if (adx > ady && adx > 50) {
      if (dx < 0) goNext()
      else goPrev()
    }
  }

  const zoneProgress = useMemo(() => {
    const perGroup: number[][] = []
    for (const g of groups) perGroup.push(new Array(g.stories.length).fill(0))
    for (let i = 0; i < flat.length; i++) {
      const { groupIndex, storyIndex } = flat[i]
      let v = 0
      if (i < flatIndex) v = 1
      else if (i === flatIndex) v = progress
      perGroup[groupIndex][storyIndex] = v
    }
    return perGroup
  }, [groups, flat, flatIndex, progress])

  if (!open) return null
  if (!group || !story) {
    return (
      <div className="fixed inset-0 z-[100] bg-black text-white flex items-center justify-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          aria-label="Close stories"
        >
          <XIcon className="h-5 w-5" />
        </button>
        <div className="text-sm text-white/80">No stories available</div>
      </div>
    )
  }

  const isMine = String(group.user._id) === String(currentUserId)

  return (
    <div
      className="fixed inset-0 z-[100] bg-black text-white select-none"
      aria-modal="true"
      role="dialog"
    >
      {/* Media stage */}
      <div
        className="absolute inset-0 touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {story.media.mediaType === 'image' ? (
          <img
            key={story._id}
            src={story.media.url}
            alt="Story"
            className="absolute inset-0 h-full w-full object-contain animate-[fadeIn_.18s_ease-out]"
            draggable={false}
          />
        ) : (
          <video
            key={story._id}
            ref={videoRef}
            src={story.media.url}
            playsInline
            muted
            loop={false}
            preload="auto"
            className="absolute inset-0 h-full w-full object-contain animate-[fadeIn_.18s_ease-out]"
          />
        )}

        {/* Left/Right tap zones for accessibility (big areas) */}
        <button
          type="button"
          aria-label="Previous story"
          onClick={goPrev}
          className="absolute top-0 left-0 h-full w-1/3 cursor-default bg-transparent"
        />
        <button
          type="button"
          aria-label="Next story"
          onClick={goNext}
          className="absolute top-0 right-0 h-full w-1/3 cursor-default bg-transparent"
        />
      </div>

      {/* Top bar: progress bars, header, close */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-3 pt-3 sm:px-6 sm:pt-4">
        {/* Progress bars (per story in current group) */}
        <div className="flex gap-1.5">
          {group.stories.map((_, i) => {
            const v = Math.max(0, Math.min(1, zoneProgress[pos.groupIndex][i] ?? 0))
            return (
              <div
                key={i}
                className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-white/25"
              >
                <div
                  className="absolute inset-y-0 left-0 bg-white rounded-full transition-[width] duration-75 linear"
                  style={{ width: `${v * 100}%` }}
                />
              </div>
            )
          })}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <AvatarUI user={group.user} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold">
                {group.user.username || isMine ? 'you' : ''}
                {!isMine && group.user.username}
                {isMine && !group.user.username ? 'Your story' : ''}
              </span>
              <span className="text-xs text-white/60">
                {formatStoryTime(story.createdAt)}
              </span>
            </div>
          </div>

          {isPaused ? (
            <div className="pointer-events-auto inline-flex items-center justify-center rounded-full bg-black/40 px-2 py-1">
              <Pause className="h-3.5 w-3.5" />
            </div>
          ) : null}

          <div className="pointer-events-auto flex items-center gap-1">
            {flatIndex > 0 ? (
              <button
                onClick={goPrev}
                className="hidden md:inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/30 hover:bg-black/50"
                aria-label="Previous"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
            ) : null}
            {flatIndex < flat.length - 1 ? (
              <button
                onClick={goNext}
                className="hidden md:inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/30 hover:bg-black/50"
                aria-label="Next"
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            ) : null}
            <button
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10"
              aria-label="Close"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {isMine ? (
          <div className="mt-2 text-[11px] text-white/60">
            {story.viewCount || 0} view{story.viewCount === 1 ? '' : 's'}
          </div>
        ) : null}
      </div>

      {/* Bottom Pause indicator when holding */}
      {isPaused ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black/50 backdrop-blur">
            <Play className="h-9 w-9 text-white" />
          </div>
        </div>
      ) : null}
    </div>
  )
}
