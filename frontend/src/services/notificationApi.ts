import { api } from "./api";

export const NOTIFICATIONS_PAGE_SIZE = 20;
export const NOTIFICATION_FEED_ARG = {
  page: 1,
  limit: NOTIFICATIONS_PAGE_SIZE,
};

export interface NotificationActor {
  _id: string;
  username: string;
  fullName: string;
  avatar: string;
}

export interface Notification {
  _id: string;
  actor: NotificationActor | null;
  actors: NotificationActor[];
  actorCount: number;
  receiver: string;
  type: "like" | "comment" | "follow" | "story_like" | "mention";
  relatedPost: string | null;
  relatedStory: string | null;
  title: string;
  message: string;
  actionUrl: string;
  previewImage: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationsResponse {
  success: boolean;
  notifications: Notification[];
  unreadCount: number;
  currentPage: number;
  totalPages: number;
  totalItems: number;
  hasMore: boolean;
}

export interface NotificationSummaryResponse {
  unreadCount: number;
}

export interface RegisterTokenRequest {
  token: string;
  platform?: "web" | "android" | "ios" | "desktop";
  userAgent?: string;
}

export interface RegisterTokenResponse {
  success: boolean;
  message: string;
  deviceId: string;
}

const patchNotificationSummary = (
  dispatch: any,
  updater: (draft: NotificationSummaryResponse) => void,
) =>
  dispatch(
    notificationApi.util.updateQueryData(
      "getNotificationSummary",
      undefined,
      updater,
    ),
  );

const patchNotificationFeed = (
  dispatch: any,
  updater: (draft: NotificationsResponse) => void,
) =>
  dispatch(
    notificationApi.util.updateQueryData(
      "getNotifications",
      NOTIFICATION_FEED_ARG,
      updater,
    ),
  );

export const notificationApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getNotifications: builder.query<
      NotificationsResponse,
      { page?: number; limit?: number } | void
    >({
      query: (args) => {
        const page = args?.page ?? 1;
        const limit = args?.limit ?? NOTIFICATIONS_PAGE_SIZE;
        return `/notifications/my-notifications?page=${page}&limit=${limit}`;
      },
      serializeQueryArgs: ({ endpointName }) => endpointName,
      merge: (currentCache, newItems, { arg }) => {
        const page = arg?.page ?? 1;

        if (page <= 1) {
          currentCache.success = newItems.success;
          currentCache.notifications = newItems.notifications;
          currentCache.unreadCount = newItems.unreadCount;
          currentCache.currentPage = newItems.currentPage;
          currentCache.totalPages = newItems.totalPages;
          currentCache.totalItems = newItems.totalItems;
          currentCache.hasMore = newItems.hasMore;
          return;
        }

        const seenIds = new Set(currentCache.notifications.map((item) => item._id));
        const mergedNotifications = [...currentCache.notifications];
        for (const item of newItems.notifications) {
          if (!seenIds.has(item._id)) {
            mergedNotifications.push(item);
            seenIds.add(item._id);
          }
        }

        currentCache.success = newItems.success;
        currentCache.notifications = mergedNotifications;
        currentCache.unreadCount = newItems.unreadCount;
        currentCache.currentPage = newItems.currentPage;
        currentCache.totalPages = newItems.totalPages;
        currentCache.totalItems = newItems.totalItems;
        currentCache.hasMore = newItems.hasMore;
      },
      forceRefetch: ({ currentArg, previousArg }) =>
        (currentArg?.page ?? 1) !== (previousArg?.page ?? 1) ||
        (currentArg?.limit ?? NOTIFICATIONS_PAGE_SIZE) !==
          (previousArg?.limit ?? NOTIFICATIONS_PAGE_SIZE),
      providesTags: (result) =>
        result?.notifications
          ? [
              ...result.notifications.map(({ _id }) => ({
                type: "Notification" as const,
                id: _id,
              })),
              { type: "Notification", id: "LIST" },
            ]
          : [{ type: "Notification", id: "LIST" }],
    }),

    getNotificationSummary: builder.query<NotificationSummaryResponse, void>({
      query: () => "/notifications/my-notifications?page=1&limit=1",
      transformResponse: (response: NotificationsResponse) => ({
        unreadCount: response.unreadCount ?? 0,
      }),
      providesTags: [{ type: "Notification", id: "SUMMARY" }],
    }),

    registerFCMToken: builder.mutation<RegisterTokenResponse, RegisterTokenRequest>({
      query: (body) => ({
        url: "/notifications/register-token",
        method: "POST",
        body,
      }),
    }),

    deactivateFCMToken: builder.mutation<{ success: boolean }, { deviceId: string }>({
      query: (body) => ({
        url: "/notifications/deactivate",
        method: "POST",
        body,
      }),
    }),

    markNotificationAsRead: builder.mutation<
      { notification: Notification },
      string
    >({
      query: (id) => ({
        url: `/notifications/${id}/read`,
        method: "PATCH",
      }),
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        const feedPatch = patchNotificationFeed(dispatch, (draft) => {
          const notification = draft.notifications.find((n) => n._id === id);
          if (notification && !notification.isRead) {
            notification.isRead = true;
            notification.readAt = new Date().toISOString();
            draft.unreadCount = Math.max(0, draft.unreadCount - 1);
          }
        });

        const summaryPatch = patchNotificationSummary(dispatch, (draft) => {
          draft.unreadCount = Math.max(0, draft.unreadCount - 1);
        });

        try {
          await queryFulfilled;
        } catch {
          feedPatch.undo();
          summaryPatch.undo();
        }
      },
    }),

    markAllNotificationsAsRead: builder.mutation<
      { success: boolean; modifiedCount: number },
      void
    >({
      query: () => ({
        url: "/notifications/read-all",
        method: "PATCH",
      }),
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        const now = new Date().toISOString();

        const feedPatch = patchNotificationFeed(dispatch, (draft) => {
          draft.notifications.forEach((notification) => {
            notification.isRead = true;
            notification.readAt = notification.readAt || now;
          });
          draft.unreadCount = 0;
        });

        const summaryPatch = patchNotificationSummary(dispatch, (draft) => {
          draft.unreadCount = 0;
        });

        try {
          await queryFulfilled;
        } catch {
          feedPatch.undo();
          summaryPatch.undo();
        }
      },
    }),

    deleteNotification: builder.mutation<{ success: boolean }, string>({
      query: (id) => ({
        url: `/notifications/${id}`,
        method: "DELETE",
      }),
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        let unreadRemoved = false;

        const feedPatch = patchNotificationFeed(dispatch, (draft) => {
          const index = draft.notifications.findIndex((item) => item._id === id);
          if (index === -1) return;

          unreadRemoved = !draft.notifications[index].isRead;
          draft.notifications.splice(index, 1);
          if (unreadRemoved) {
            draft.unreadCount = Math.max(0, draft.unreadCount - 1);
          }
        });

        const summaryPatch = unreadRemoved
          ? patchNotificationSummary(dispatch, (draft) => {
              draft.unreadCount = Math.max(0, draft.unreadCount - 1);
            })
          : null;

        try {
          await queryFulfilled;
        } catch {
          feedPatch.undo();
          summaryPatch?.undo();
        }
      },
    }),

    sendTestNotification: builder.mutation<{ success: boolean }, void>({
      query: () => ({
        url: "/notifications/test",
        method: "POST",
      }),
      invalidatesTags: [
        { type: "Notification", id: "LIST" },
        { type: "Notification", id: "SUMMARY" },
      ],
    }),
  }),
});

export const {
  useGetNotificationsQuery,
  useGetNotificationSummaryQuery,
  useRegisterFCMTokenMutation,
  useDeactivateFCMTokenMutation,
  useMarkNotificationAsReadMutation,
  useMarkAllNotificationsAsReadMutation,
  useDeleteNotificationMutation,
  useSendTestNotificationMutation,
} = notificationApi;

export default notificationApi;
