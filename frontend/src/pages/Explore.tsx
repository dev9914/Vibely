import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Play, Search, X, Clock3, Heart, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  type ExplorePost,
  type ExploreUser,
  useGetExploreQuery,
  useSearchPostsQuery,
  useSearchUsersQuery,
} from "@/services/exploreApi";

const RECENT_SEARCHES_KEY = "explore-recent-searches";
const PAGE_SIZE = 36;

const loadRecentSearches = () => {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.slice(0, 10) : [];
  } catch {
    return [];
  }
};

const saveRecentSearches = (items: string[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(items.slice(0, 10)));
};

const useDebouncedValue = <T,>(value: T, delay = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);
  return debounced;
};

const formatCompact = (n: number) => {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, "") + "K";
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
};

const isVideoPost = (post: ExplorePost) => {
  const first = post.postImage?.[0] || post.previewImage || "";
  return /\.(mp4|webm|mov|m3u8)(\?|$)/i.test(first) || (post as any).mediaType === "video";
};

const pickTileAspect = (i: number) => {
  const m = i % 10;
  if (m === 3 || m === 7) return "aspect-[4/5]";
  return "aspect-square";
};

const PostTile = ({
  post,
  aspectClass,
}: {
  post: ExplorePost;
  aspectClass: string;
}) => {
  const isVideo = isVideoPost(post);
  return (
    <div className="mb-1 break-inside-avoid">
      <Link
        to={`/post/${post._id}`}
        className={cn(
          "group relative block w-full overflow-hidden bg-muted",
          aspectClass
        )}
      >
        {isVideo ? (
          <video
            src={post.previewImage || post.postImage?.[0]}
            muted
            loop
            playsInline
            preload="metadata"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onMouseEnter={(e) => {
              (e.target as HTMLVideoElement).play().catch(() => {});
            }}
            onMouseLeave={(e) => {
              const v = e.target as HTMLVideoElement;
              v.pause();
              v.currentTime = 0;
            }}
          />
        ) : (
          <img
            src={post.previewImage || post.postImage?.[0]}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        )}

        {isVideo && (
          <div className="pointer-events-none absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur">
            <Play className="h-3 w-3 fill-current" />
          </div>
        )}

        <div className="absolute inset-0 z-10 flex items-center justify-center gap-5 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex items-center gap-1.5 text-white font-semibold text-sm sm:text-base">
            <Heart className="h-4 w-4 sm:h-5 sm:w-5 fill-white" />
            <span>{formatCompact(post.likesCount ?? 0)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-white font-semibold text-sm sm:text-base">
            <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 fill-white" />
            <span>{formatCompact(post.commentsCount ?? 0)}</span>
          </div>
        </div>
      </Link>
    </div>
  );
};

const UserResult = ({ user }: { user: ExploreUser }) => (
  <Link
    to={`/user/${user._id}`}
    className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent transition-colors"
  >
    <Avatar className="h-10 w-10 shrink-0">
      <AvatarImage src={user.avatar} alt={user.username} />
      <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
    </Avatar>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold text-foreground">{user.username}</p>
      <p className="truncate text-sm text-muted-foreground">{user.fullName}</p>
    </div>
  </Link>
);

const GridSkeleton = () => (
  <div className="columns-1 gap-1 sm:columns-2 md:columns-2 lg:columns-3 xl:columns-4">
    {Array.from({ length: 18 }).map((_, i) => (
      <div
        key={i}
        className={cn("mb-1 break-inside-avoid w-full overflow-hidden bg-muted", pickTileAspect(i))}
      >
        <Skeleton className="h-full w-full" />
      </div>
    ))}
  </div>
);

const Explore = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => loadRecentSearches());
  const [exploreCursor, setExploreCursor] = useState<string | null>(null);
  const [searchCursor, setSearchCursor] = useState<string | null>(null);
  const [userSearchCursor, setUserSearchCursor] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const debouncedQuery = useDebouncedValue(searchQuery, 300);
  const trimmedQuery = debouncedQuery.trim();
  const hasSearch = trimmedQuery.length > 0;

  useEffect(() => {
    setSearchCursor(null);
    setUserSearchCursor(null);
  }, [trimmedQuery]);

  const exploreResult = useGetExploreQuery(
    { tab: "trending", cursor: exploreCursor, limit: PAGE_SIZE },
    { skip: hasSearch, refetchOnFocus: true }
  );

  const postSearchResult = useSearchPostsQuery(
    { q: trimmedQuery, mode: "trending", cursor: searchCursor, limit: PAGE_SIZE, scope: "main" },
    { skip: !hasSearch }
  );

  const userSearchResult = useSearchUsersQuery(
    { q: trimmedQuery, cursor: userSearchCursor, limit: 10, scope: "suggestions" },
    { skip: !showDropdown || !hasSearch }
  );

  const currentPosts = useMemo(() => {
    if (hasSearch) return postSearchResult.data?.posts || [];
    return exploreResult.data && "posts" in exploreResult.data ? exploreResult.data.posts : [];
  }, [hasSearch, postSearchResult.data, exploreResult.data]);

  const currentHasMore = hasSearch
    ? postSearchResult.data?.hasMore || false
    : exploreResult.data?.hasMore || false;

  const currentNextCursor = hasSearch
    ? postSearchResult.data?.nextCursor || null
    : exploreResult.data?.nextCursor || null;

  const currentFetching = hasSearch ? postSearchResult.isFetching : exploreResult.isFetching;
  const currentLoading = hasSearch ? postSearchResult.isLoading : exploreResult.isLoading;

  useEffect(() => {
    if (!loadMoreRef.current || !currentHasMore || !currentNextCursor || currentFetching) return;
    const node = loadMoreRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (hasSearch) {
          setSearchCursor((prev) => (prev === currentNextCursor ? prev : currentNextCursor));
        } else {
          setExploreCursor((prev) => (prev === currentNextCursor ? prev : currentNextCursor));
        }
      },
      { root: null, rootMargin: "400px", threshold: 0 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [currentFetching, currentHasMore, currentNextCursor, hasSearch]);

  const applySearch = (value: string) => {
    const next = value.trim();
    setSearchQuery(value);
    setShowDropdown(false);
    if (!next) return;
    const updated = [next, ...recentSearches.filter((i) => i !== next)].slice(0, 10);
    setRecentSearches(updated);
    saveRecentSearches(updated);
  };

  const removeRecent = (value: string) => {
    const updated = recentSearches.filter((i) => i !== value);
    setRecentSearches(updated);
    saveRecentSearches(updated);
  };

  const tiles = useMemo(() => {
    return currentPosts.map((post, i) => ({
      post,
      aspect: pickTileAspect(i),
      key: post._id + "-" + i,
    }));
  }, [currentPosts]);

  const hasRecent = recentSearches.length > 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-2 py-4 sm:px-4 sm:py-6 md:px-6 lg:px-8">
      <div className="relative mb-4 sm:mb-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            applySearch(searchQuery);
          }}
        >
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search"
            className="h-11 sm:h-12 rounded-full bg-muted/50 border-transparent pl-11 pr-10 focus-visible:ring-offset-0 text-base"
          />
          {searchQuery && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full hover:bg-accent"
              onClick={() => {
                setSearchQuery("");
                setShowDropdown(false);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </form>

        {showDropdown && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setShowDropdown(false)} />
            <div className="absolute inset-x-0 top-[calc(100%+8px)] z-40 max-h-[70vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
              {!hasSearch ? (
                hasRecent ? (
                  <div className="p-2">
                    <div className="flex items-center justify-between px-3 py-2">
                      <p className="text-sm font-semibold">Recent</p>
                      <button
                        type="button"
                        onClick={() => {
                          setRecentSearches([]);
                          saveRecentSearches([]);
                        }}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Clear all
                      </button>
                    </div>
                    <div>
                      {recentSearches.map((item) => (
                        <div
                          key={item}
                          className="group flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-accent"
                        >
                          <button
                            type="button"
                            onClick={() => applySearch(item)}
                            className="flex min-w-0 flex-1 items-center gap-3 text-left"
                          >
                            <Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="truncate text-sm">{item}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRecent(item)}
                            className="h-6 w-6 shrink-0 rounded-full text-muted-foreground opacity-0 hover:bg-accent-foreground/10 group-hover:opacity-100 flex items-center justify-center"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null
              ) : (
                <div className="p-2">
                  {userSearchResult.data?.users?.length > 0 && (
                    <div>
                      <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Accounts
                      </p>
                      {userSearchResult.data.users.slice(0, 5).map((u) => (
                        <UserResult key={u._id} user={u} />
                      ))}
                    </div>
                  )}
                  {postSearchResult.data?.posts?.length > 0 && (
                    <div>
                      <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Posts
                      </p>
                      <div className="grid grid-cols-4 gap-0.5 p-2">
                        {postSearchResult.data.posts.slice(0, 8).map((post) => (
                          <Link
                            key={post._id}
                            to={`/post/${post._id}`}
                            onClick={() => applySearch(trimmedQuery)}
                            className="aspect-square overflow-hidden bg-muted hover:opacity-90"
                          >
                            <img
                              src={post.previewImage || post.postImage?.[0]}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {currentLoading ? (
        <GridSkeleton />
      ) : currentPosts.length > 0 ? (
        <div className="columns-1 gap-1 sm:columns-2 md:columns-2 lg:columns-3 xl:columns-4">
          {tiles.map(({ post, aspect, key }) => (
            <PostTile key={key} post={post} aspectClass={aspect} />
          ))}
        </div>
      ) : (
        <div className="py-24 text-center">
          <Search className="mx-auto h-12 w-12 text-muted-foreground/60" />
          <h3 className="mt-6 text-lg font-semibold">
            {hasSearch ? "No results found" : "Nothing to show yet"}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {hasSearch ? "Try a different search term" : "Check back soon for new posts"}
          </p>
        </div>
      )}

      {currentHasMore && <div ref={loadMoreRef} className="h-12" />}

      {currentFetching && !currentLoading && (
        <div className="py-6">
          <GridSkeleton />
        </div>
      )}
    </div>
  );
};

export default Explore;
