import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Loader2, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  NOTIFICATIONS_PAGE_SIZE,
  type Notification,
  useDeleteNotificationMutation,
  useGetNotificationsQuery,
  useMarkAllNotificationsAsReadMutation,
  useMarkNotificationAsReadMutation,
} from "@/services/notificationApi";

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const formatRelativeTime = (dateString: string) =>
  formatDistanceToNow(parseISO(dateString), { addSuffix: false })
    .replace("about ", "")
    .replace("less than a minute", "now")
    .replace(" minutes", "m")
    .replace(" minute", "m")
    .replace(" hours", "h")
    .replace(" hour", "h")
    .replace(" days", "d")
    .replace(" day", "d")
    .replace(" weeks", "w")
    .replace(" week", "w")
    .replace(" months", "mo")
    .replace(" month", "mo");

const actorNames = (notification: Notification) => {
  const names = notification.actors
    .map((actor) => actor.username)
    .filter(Boolean);

  if (names.length === 0 && notification.actor?.username) {
    return notification.actor.username;
  }

  if (notification.actorCount <= 1 || names.length <= 1) {
    return names[0] || notification.actor?.username || "Someone";
  }

  if (notification.actorCount === 2 && names.length >= 2) {
    return `${names[0]} and ${names[1]}`;
  }

  const others = Math.max(1, notification.actorCount - 2);
  return `${names[0] || "Someone"}, ${names[1] || "someone"} and ${others} other${others > 1 ? "s" : ""}`;
};

const actionText = (notification: Notification) => {
  switch (notification.type) {
    case "follow":
      return "started following you.";
    case "like":
      return "liked your post.";
    case "comment":
      return "commented on your post.";
    case "story_like":
      return "liked your story.";
    case "mention":
      return "mentioned you.";
    default:
      return notification.message || "sent you a notification.";
  }
};

const NotificationSkeleton = () => (
  <div className="flex items-center gap-3 px-4 py-3">
    <div className="h-11 w-11 rounded-full bg-zinc-800 animate-pulse" />
    <div className="flex-1 space-y-2">
      <div className="h-3.5 w-3/4 rounded bg-zinc-800 animate-pulse" />
      <div className="h-3 w-1/2 rounded bg-zinc-900 animate-pulse" />
    </div>
    <div className="h-11 w-11 rounded-md bg-zinc-800 animate-pulse" />
  </div>
);

const NotificationPanel: React.FC<NotificationPanelProps> = ({
  isOpen,
  onClose,
}) => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const [markAllAsRead, { isLoading: markingAll }] =
    useMarkAllNotificationsAsReadMutation();
  const [markAsRead] = useMarkNotificationAsReadMutation();
  const [deleteNotification] = useDeleteNotificationMutation();

  const {
    data,
    isLoading,
    isFetching,
    isError,
  } = useGetNotificationsQuery(
    { page, limit: NOTIFICATIONS_PAGE_SIZE },
    {
      skip: !isOpen,
      refetchOnFocus: true,
      refetchOnReconnect: true,
    },
  );

  useEffect(() => {
    if (isOpen) {
      setPage(1);
    }
  }, [isOpen]);

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;
  const hasMore = data?.hasMore || false;

  useEffect(() => {
    if (!isOpen || !loadMoreRef.current || !hasMore || isFetching) return;

    const node = loadMoreRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setPage((current) => current + 1);
        }
      },
      {
        root: null,
        rootMargin: "160px",
        threshold: 0,
      },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isFetching, isOpen]);

  const groupedByReadState = useMemo(() => {
    return {
      unread: notifications.filter((item) => !item.isRead),
      read: notifications.filter((item) => item.isRead),
    };
  }, [notifications]);

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead().unwrap();
    } catch (error) {
      console.error(error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    try {
      if (!notification.isRead) {
        await markAsRead(notification._id).unwrap();
      }

      if (notification.actionUrl) {
        navigate(notification.actionUrl);
      }

      onClose();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (
    event: React.MouseEvent<HTMLButtonElement>,
    id: string,
  ) => {
    event.stopPropagation();
    try {
      await deleteNotification(id).unwrap();
    } catch (error) {
      console.error(error);
    }
  };

  const NotificationItem = ({ notification }: { notification: Notification }) => (
    <button
      type="button"
      onClick={() => handleNotificationClick(notification)}
      className={cn(
        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
        "hover:bg-zinc-900/70",
        !notification.isRead && "bg-zinc-900/35",
      )}
    >
      <Avatar className="h-11 w-11 shrink-0">
        <AvatarImage
          src={notification.actor?.avatar || "/default-avatar.png"}
          alt={notification.actor?.username || "Notification actor"}
        />
        <AvatarFallback className="bg-zinc-800 text-white">
          {(notification.actor?.username || "N").charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-white">
          <span className="font-semibold">{actorNames(notification)}</span>{" "}
          <span className="text-zinc-300">{actionText(notification)}</span>{" "}
          <span className="text-zinc-500">
            {formatRelativeTime(notification.updatedAt || notification.createdAt)}
          </span>
        </p>

        {notification.message && (
          <p className="mt-1 truncate text-xs text-zinc-500">
            {notification.message}
          </p>
        )}
      </div>

      {notification.previewImage ? (
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md bg-zinc-800">
          <img
            src={notification.previewImage}
            alt="Notification preview"
            className="h-full w-full object-cover"
            loading="lazy"
          />
        </div>
      ) : null}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-white"
        onClick={(event) => handleDelete(event, notification._id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </button>
  );

  const NotificationSection = ({
    title,
    items,
  }: {
    title: string;
    items: Notification[];
  }) => {
    if (!items.length) return null;

    return (
      <div>
        <h3 className="px-4 py-3 text-sm font-semibold text-white">{title}</h3>
        <div>
          {items.map((notification) => (
            <NotificationItem
              key={notification._id}
              notification={notification}
            />
          ))}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 left-[72px] z-40 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className={cn(
          "fixed top-0 left-[72px] z-50 h-screen w-[420px] bg-zinc-950",
          "border-r border-zinc-800 rounded-r-3xl shadow-2xl overflow-hidden",
          "animate-in slide-in-from-left duration-300",
        )}
      >
        <div className="flex items-center justify-between px-6 py-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Notifications</h2>
            <p className="mt-1 text-xs text-zinc-500">
              {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-zinc-400 hover:text-white"
              onClick={handleMarkAllRead}
              disabled={markingAll || unreadCount === 0}
            >
              Mark all as read
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-9 w-9 rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-88px)]">
          {isLoading ? (
            <div className="space-y-1 py-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <NotificationSkeleton key={index} />
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-20 px-4">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900">
                <Bell className="h-8 w-8 text-zinc-600" />
              </div>
              <p className="mb-1 text-sm font-medium text-white">
                Unable to load notifications
              </p>
              <p className="text-center text-xs text-zinc-500">
                Please try again in a moment.
              </p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-zinc-900">
                <Bell className="h-10 w-10 text-zinc-600" />
              </div>
              <p className="mb-1 text-lg font-medium text-white">
                No notifications yet
              </p>
              <p className="text-center text-sm text-zinc-500">
                Likes, comments, and follows will show up here.
              </p>
            </div>
          ) : (
            <div className="pb-6">
              <NotificationSection
                title="Unread"
                items={groupedByReadState.unread}
              />
              {groupedByReadState.unread.length > 0 &&
              groupedByReadState.read.length > 0 ? (
                <Separator className="my-2 bg-zinc-800" />
              ) : null}
              <NotificationSection
                title="Earlier"
                items={groupedByReadState.read}
              />

              {isFetching && page > 1 ? (
                <div className="flex items-center justify-center gap-2 py-4 text-sm text-zinc-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading more notifications...
                </div>
              ) : null}

              {hasMore ? <div ref={loadMoreRef} className="h-8" /> : null}
            </div>
          )}
        </ScrollArea>
      </div>
    </>
  );
};

export default NotificationPanel;
