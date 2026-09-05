import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "sonner";
import type { Socket } from "socket.io-client";
import { connectSocketWithAuth, getSocket } from "@/lib/socket";
import { SOCKET_EVENTS } from "@/lib/constants";
import {
  NOTIFICATION_FEED_ARG,
  notificationApi,
  type Notification,
} from "@/services/notificationApi";
import { selectIsAuthenticated } from "@/store/authSlice";
import type { AppDispatch } from "@/store/store";

type NewNotificationPayload = {
  notification?: Notification;
  unreadCount?: number;
};

export function useNotificationSocket() {
  const dispatch = useDispatch<AppDispatch>();
  const isAuthenticated = useSelector(selectIsAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    let socket: Socket | null = null;

    const handleNewNotification = (payload: NewNotificationPayload) => {
      const notification = payload?.notification;
      if (!notification?._id) return;

      dispatch(
        notificationApi.util.updateQueryData(
          "getNotifications",
          NOTIFICATION_FEED_ARG,
          (draft) => {
            const exists = draft.notifications.some(
              (item) => item._id === notification._id,
            );
            const previousLength = draft.notifications.length;

            if (!exists) {
              draft.notifications.unshift(notification);
            } else {
              const index = draft.notifications.findIndex(
                (item) => item._id === notification._id,
              );
              draft.notifications[index] = notification;
            }

            draft.unreadCount = payload.unreadCount ?? draft.unreadCount;
            draft.totalItems = exists
              ? Math.max(draft.totalItems, draft.notifications.length)
              : Math.max(draft.totalItems + 1, previousLength + 1);
            draft.hasMore =
              draft.totalItems > draft.notifications.length || draft.hasMore;
          },
        ),
      );

      dispatch(
        notificationApi.util.upsertQueryData(
          "getNotificationSummary",
          undefined,
          { unreadCount: payload.unreadCount ?? 1 },
        ),
      );

      toast(notification.title || "New notification", {
        description: notification.message || undefined,
        duration: 5000,
      });
    };

    const setup = async () => {
      let connectedSocket = getSocket();
      if (!connectedSocket) {
        connectedSocket = await connectSocketWithAuth();
      }
      if (cancelled || !connectedSocket) return;

      socket = connectedSocket;
      socket.on(SOCKET_EVENTS.NEW_NOTIFICATION, handleNewNotification);
    };

    void setup();

    return () => {
      cancelled = true;
      if (socket) {
        socket.off(SOCKET_EVENTS.NEW_NOTIFICATION, handleNewNotification);
      }
    };
  }, [dispatch, isAuthenticated]);
}
