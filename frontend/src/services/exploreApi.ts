import { api } from "./api";

const DEFAULT_LIMIT = 18;

export interface ExploreAuthor {
  _id: string;
  username: string;
  fullName: string;
  avatar: string;
}

export interface ExplorePost {
  _id: string;
  userId: string;
  postImage: string[];
  previewImage?: string | null;
  description: string;
  likes: string[];
  comments: Array<{
    _id?: string;
    userId: string;
    text: string;
    username: string;
    avatar: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
  likesCount: number;
  commentsCount: number;
  savedCount: number;
  recencyBoost: number;
  trendingScore: number;
  author?: ExploreAuthor;
  isSaved?: boolean;
}

export interface ExploreUser {
  _id: string;
  username: string;
  fullName: string;
  avatar: string;
  followersCount: number;
  followingCount: number;
}

export interface HashtagItem {
  tag: string;
  postCount: number;
  trendingScore: number;
  previewImages: string[];
  latestPostAt: string;
}

export interface ExplorePostsResponse {
  mode: "trending" | "recent";
  posts: ExplorePost[];
  nextCursor: string | null;
  hasMore: boolean;
  trendingHashtags: HashtagItem[];
}

export interface ExplorePeopleResponse {
  mode: "people";
  users: ExploreUser[];
  nextCursor: string | null;
  hasMore: boolean;
  trendingHashtags: HashtagItem[];
}

export interface SearchPostsResponse {
  posts: ExplorePost[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface SearchUsersResponse {
  users: ExploreUser[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface SearchHashtagsResponse {
  hashtags: HashtagItem[];
  nextCursor: string | null;
  hasMore: boolean;
}

const appendUniqueById = <T extends { _id: string }>(currentItems: T[], nextItems: T[]) => {
  const seen = new Set(currentItems.map((item) => item._id));
  const merged = [...currentItems];

  for (const item of nextItems) {
    if (!seen.has(item._id)) {
      merged.push(item);
      seen.add(item._id);
    }
  }

  return merged;
};

const appendUniqueTags = (currentItems: HashtagItem[], nextItems: HashtagItem[]) => {
  const seen = new Set(currentItems.map((item) => item.tag));
  const merged = [...currentItems];

  for (const item of nextItems) {
    if (!seen.has(item.tag)) {
      merged.push(item);
      seen.add(item.tag);
    }
  }

  return merged;
};

export const exploreApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getExplore: builder.query<
      ExplorePostsResponse | ExplorePeopleResponse,
      { tab: "trending" | "recent" | "people"; cursor?: string | null; limit?: number }
    >({
      query: ({ tab, cursor, limit = DEFAULT_LIMIT }) => {
        const params = new URLSearchParams({ tab, limit: String(limit) });
        if (cursor) params.set("cursor", cursor);
        return `/explore?${params.toString()}`;
      },
      serializeQueryArgs: ({ endpointName, queryArgs }) =>
        `${endpointName}-${queryArgs.tab}`,
      merge: (currentCache, newItems, { arg }) => {
        if (!arg.cursor) {
          Object.assign(currentCache, newItems);
          return;
        }

        if ("posts" in currentCache && "posts" in newItems) {
          currentCache.posts = appendUniqueById(currentCache.posts, newItems.posts);
        }

        if ("users" in currentCache && "users" in newItems) {
          currentCache.users = appendUniqueById(currentCache.users, newItems.users);
        }

        currentCache.nextCursor = newItems.nextCursor;
        currentCache.hasMore = newItems.hasMore;
        currentCache.trendingHashtags = appendUniqueTags(
          currentCache.trendingHashtags,
          newItems.trendingHashtags,
        );
      },
      forceRefetch: ({ currentArg, previousArg }) =>
        currentArg?.tab !== previousArg?.tab ||
        currentArg?.cursor !== previousArg?.cursor,
      providesTags: (_result, _error, arg) => [{ type: "Explore", id: `EXPLORE-${arg.tab}` }],
    }),

    searchUsers: builder.query<
      SearchUsersResponse,
      { q: string; cursor?: string | null; limit?: number; scope?: string }
    >({
      query: ({ q, cursor, limit = DEFAULT_LIMIT }) => {
        const safeQ = (q || "").trim();
        const params = new URLSearchParams({ q: safeQ, limit: String(limit) });
        if (cursor) params.set("cursor", cursor);
        return `/search/users?${params.toString()}`;
      },
      serializeQueryArgs: ({ endpointName, queryArgs }) =>
        `${endpointName}-${queryArgs.scope || "default"}-${(queryArgs.q || "").trim().toLowerCase()}`,
      merge: (currentCache, newItems, { arg }) => {
        if (!arg.cursor) {
          Object.assign(currentCache, newItems);
          return;
        }

        currentCache.users = appendUniqueById(currentCache.users, newItems.users);
        currentCache.nextCursor = newItems.nextCursor;
        currentCache.hasMore = newItems.hasMore;
      },
      forceRefetch: ({ currentArg, previousArg }) =>
        (currentArg?.q || "") !== (previousArg?.q || "") ||
        currentArg?.cursor !== previousArg?.cursor,
      providesTags: (_result, _error, arg) => [{ type: "Explore", id: `SEARCH-USERS-${(arg?.q || "").trim().toLowerCase()}` }],
    }),

    searchPosts: builder.query<
      SearchPostsResponse,
      { q: string; mode?: "trending" | "recent"; cursor?: string | null; limit?: number; scope?: string }
    >({
      query: ({ q, mode = "trending", cursor, limit = DEFAULT_LIMIT }) => {
        const safeQ = (q || "").trim();
        const params = new URLSearchParams({
          q: safeQ,
          mode,
          limit: String(limit),
        });
        if (cursor) params.set("cursor", cursor);
        return `/search/posts?${params.toString()}`;
      },
      serializeQueryArgs: ({ endpointName, queryArgs }) =>
        `${endpointName}-${queryArgs.scope || "default"}-${queryArgs.mode || "trending"}-${(queryArgs.q || "").trim().toLowerCase()}`,
      merge: (currentCache, newItems, { arg }) => {
        if (!arg.cursor) {
          Object.assign(currentCache, newItems);
          return;
        }

        currentCache.posts = appendUniqueById(currentCache.posts, newItems.posts);
        currentCache.nextCursor = newItems.nextCursor;
        currentCache.hasMore = newItems.hasMore;
      },
      forceRefetch: ({ currentArg, previousArg }) =>
        (currentArg?.q || "") !== (previousArg?.q || "") ||
        (currentArg?.mode || "trending") !== (previousArg?.mode || "trending") ||
        currentArg?.cursor !== previousArg?.cursor,
      providesTags: (_result, _error, arg) => [{ type: "Explore", id: `SEARCH-POSTS-${arg?.mode || "trending"}-${(arg?.q || "").trim().toLowerCase()}` }],
    }),

    searchHashtags: builder.query<
      SearchHashtagsResponse,
      { q?: string; cursor?: string | null; limit?: number; scope?: string }
    >({
      query: ({ q = "", cursor, limit = 8 }) => {
        const safeQ = (q || "").trim();
        const params = new URLSearchParams({ q: safeQ, limit: String(limit) });
        if (cursor) params.set("cursor", cursor);
        return `/search/hashtags?${params.toString()}`;
      },
      serializeQueryArgs: ({ endpointName, queryArgs }) =>
        `${endpointName}-${queryArgs.scope || "default"}-${(queryArgs.q || "").trim().toLowerCase()}`,
      merge: (currentCache, newItems, { arg }) => {
        if (!arg.cursor) {
          Object.assign(currentCache, newItems);
          return;
        }

        currentCache.hashtags = appendUniqueTags(currentCache.hashtags, newItems.hashtags);
        currentCache.nextCursor = newItems.nextCursor;
        currentCache.hasMore = newItems.hasMore;
      },
      forceRefetch: ({ currentArg, previousArg }) =>
        (currentArg?.q || "") !== (previousArg?.q || "") ||
        currentArg?.cursor !== previousArg?.cursor,
      providesTags: (_result, _error, arg) => [{ type: "Explore", id: `SEARCH-HASHTAGS-${(arg?.q || "").trim().toLowerCase()}` }],
    }),
  }),
});

export const {
  useGetExploreQuery,
  useSearchUsersQuery,
  useSearchPostsQuery,
  useSearchHashtagsQuery,
} = exploreApi;

export default exploreApi;
