import { api } from './api';

export interface StoryMedia {
  mediaType: 'image' | 'video';
  url: string;
}

export interface StoryUser {
  _id: string;
  username?: string;
  fullName?: string;
  avatar?: string;
}

export interface StoryItem {
  _id: string;
  user: StoryUser;
  media: StoryMedia;
  createdAt: string;
  expiresAt: string;
  viewCount: number;
  hasViewed: boolean;
}

export interface StoryGroup {
  user: StoryUser;
  stories: StoryItem[];
  hasUnseen: boolean;
}

export interface StoriesFeedResponse {
  groups: StoryGroup[];
  mine: StoryGroup | null;
  currentUserId: string;
}

export interface UserStoriesResponse {
  user?: StoryUser | null;
  stories: StoryItem[];
  hasUnseen: boolean;
}

export const storyApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getStoriesFeed: builder.query<StoriesFeedResponse, void>({
      query: () => '/stories',
      providesTags: (result) =>
        result
          ? [
              ...result.groups.flatMap((g) =>
                g.stories.map((s) => ({ type: 'Story' as const, id: s._id })),
              ),
              ...(result.mine
                ? result.mine.stories.map((s) => ({ type: 'Story' as const, id: s._id }))
                : []),
              { type: 'Story', id: 'FEED' },
            ]
          : [{ type: 'Story', id: 'FEED' }],
      onQueryStarted: async (_arg, { queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled;
          if (!data) return;
          const markAll: Promise<unknown>[] = [];
          const all = (data.groups || []).concat(data.mine ? [data.mine] : []);
          for (const g of all) {
            for (const s of g.stories) {
              if (s.hasViewed) continue;
              try {
                const entry = api.util.selectCachedArgsForQuery(storyApi.endpoints.markStoryViewed, s._id as any);
                if (entry && (entry as any[]).length > 0) continue;
              } catch {
                // noop
              }
            }
          }
          await Promise.all(markAll);
        } catch {
          // noop
        }
      },
    }),

    getUserStories: builder.query<UserStoriesResponse, string>({
      query: (userId) => `/stories/user/${userId}`,
      providesTags: (result, _err, userId) =>
        result
          ? [
              ...result.stories.map((s) => ({ type: 'Story' as const, id: s._id })),
              { type: 'Story', id: `USER-${userId}` },
            ]
          : [{ type: 'Story', id: `USER-${userId}` }],
    }),

    createStory: builder.mutation<{ count: number; ids: string[] }, FormData>({
      query: (formData) => ({
        url: '/stories',
        method: 'POST',
        body: formData,
      }),
      invalidatesTags: [{ type: 'Story', id: 'FEED' }],
    }),

    deleteStory: builder.mutation<{ deleted: boolean }, string>({
      query: (storyId) => ({
        url: `/stories/${storyId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, _err, storyId) => [
        { type: 'Story', id: storyId },
        { type: 'Story', id: 'FEED' },
      ],
    }),

    markStoryViewed: builder.mutation<{ viewed: boolean }, string>({
      query: (storyId) => ({
        url: `/stories/${storyId}/view`,
        method: 'PUT',
      }),
      async onQueryStarted(storyId, { dispatch, queryFulfilled }) {
        const patchFeed = dispatch(
          storyApi.util.updateQueryData('getStoriesFeed', undefined, (draft) => {
            const patchStory = (s: StoryItem) => {
              if (s._id !== storyId) return;
              s.hasViewed = true;
              s.viewCount = Math.max(s.viewCount, 1);
            };
            const patchGroup = (g: StoryGroup) => {
              for (const s of g.stories) patchStory(s);
              g.hasUnseen = g.stories.some((s) => !s.hasViewed);
            };
            for (const g of draft.groups) patchGroup(g);
            if (draft.mine) patchGroup(draft.mine);
          })
        );

        let userStoriesPatches: any[] = [];
        try {
          const allKeys = (api.endpoints.getUserStories as any)?.selectCachedArgsForQuery?.(
            storyApi.endpoints.getUserStories,
            undefined as any,
          );
          if (Array.isArray(allKeys)) {
            userStoriesPatches = allKeys.map(({ originalArgs }: any) =>
              dispatch(
                storyApi.util.updateQueryData('getUserStories', originalArgs, (draft) => {
                  for (const s of draft.stories) {
                    if (s._id === storyId) {
                      s.hasViewed = true;
                      s.viewCount = Math.max(s.viewCount, 1);
                    }
                  }
                  draft.hasUnseen = draft.stories.some((s) => !s.hasViewed);
                })
              )
            );
          }
        } catch {
          // ignore
        }

        try {
          await queryFulfilled;
        } catch {
          patchFeed.undo();
          userStoriesPatches.forEach((p) => p.undo && p.undo());
        }
      },
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetStoriesFeedQuery,
  useGetUserStoriesQuery,
  useCreateStoryMutation,
  useDeleteStoryMutation,
  useMarkStoryViewedMutation,
} = storyApi;

export default storyApi;
