import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Loader2, Send, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useGetUserByIdQuery } from "@/services/userApi";
import {
  messageApi,
  useGetMessagesQuery,
  useSendMessageMutation,
  useMarkMessagesAsReadMutation,
  useLazyLoadMoreMessagesQuery,
} from "@/services/messageApi";
import { MessageBubble } from "@/components/messages/MessageBubble";
import {
  emitTypingStart,
  emitTypingStop,
  emitMessageSeen,
} from "@/hooks/useMessagingSocket";
import { getMessageUserId } from "@/lib/messageUtils";
import { setActiveChat } from "@/store/messagingSlice";
import {
  selectIsUserOnline,
  selectUserLastSeen,
  selectTypingByConversation,
} from "@/store/messagingSlice";
import { formatMessageTime } from "@/lib/date";
import type { AppDispatch, RootState } from "@/store/store";

interface ChatProps {
  userId: string;
  userAvatar: string;
  username: string;
}

const Chat = ({ userId }: ChatProps) => {
  const { receiverId } = useParams();
  const dispatch = useDispatch<AppDispatch>();
  const [text, setText] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingMoreRef = useRef(false);

  const typingByConversation = useSelector(selectTypingByConversation);

  const { data: userData } = useGetUserByIdQuery(receiverId!, { skip: !receiverId });
  const { data: messagesData, isLoading: messagesLoading } = useGetMessagesQuery(
    receiverId!,
    { skip: !receiverId },
  );
  const [sendMsg, { isLoading: isSending }] = useSendMessageMutation();
  const [markRead] = useMarkMessagesAsReadMutation();
  const [loadMore] = useLazyLoadMoreMessagesQuery();

  const user = userData?.user || null;
  const messages = messagesData?.messages ?? [];
  const conversationId = messagesData?.conversationId ?? null;

  const isOnline = useSelector((state: RootState) =>
    selectIsUserOnline(state, receiverId),
  );
  const lastSeen = useSelector((state: RootState) =>
    selectUserLastSeen(state, receiverId),
  );
  const isTyping = conversationId ? !!typingByConversation[conversationId] : false;

  useEffect(() => {
    setHasMore(messagesData?.hasMore ?? false);
  }, [messagesData?.hasMore]);

  useEffect(() => {
    if (!receiverId) return;
    dispatch(setActiveChat({ conversationId, userId: receiverId }));
    dispatch(
      messageApi.util.updateQueryData("getConversations", undefined, (draft) => {
        const conversation = draft?.conversations?.find((c) => c.user._id === receiverId);
        if (conversation) conversation.unreadCount = 0;
      }),
    );
    return () => dispatch(setActiveChat({ conversationId: null, userId: null }));
  }, [receiverId, conversationId, dispatch]);

  useEffect(() => {
    if (conversationId) {
      markRead(conversationId);
      emitMessageSeen(conversationId);
    }
  }, [conversationId, markRead]);

  const lastMarkedMessageRef = useRef<string | null>(null);
  useEffect(() => {
    if (!conversationId || !receiverId || messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    if (getMessageUserId(lastMessage.senderId) !== receiverId) return;
    if (lastMarkedMessageRef.current === lastMessage._id) return;

    lastMarkedMessageRef.current = lastMessage._id;
    markRead(conversationId);
    emitMessageSeen(conversationId);
  }, [messages, conversationId, receiverId, markRead]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleTyping = useCallback(
    (value: string) => {
      setText(value);
      if (!conversationId || !receiverId) return;

      emitTypingStart(conversationId, receiverId);

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        emitTypingStop(conversationId, receiverId);
      }, 2000);
    },
    [conversationId, receiverId],
  );

  const sendMessage = async () => {
    if (!text.trim() || !receiverId || isSending) return;

    const clientId = `client-${Date.now()}`;
    const messageText = text.trim();
    setText("");
    emitTypingStop(conversationId!, receiverId);

    try {
      await sendMsg({
        receiverId,
        message: messageText,
        clientId,
      }).unwrap();
    } catch (error) {
      console.error(error);
    }
  };

  const handleLoadMore = async () => {
    if (!receiverId || !hasMore || isLoadingMoreRef.current || messages.length === 0) return;

    isLoadingMoreRef.current = true;
    const oldestId = messages[0]._id;

    try {
      const result = await loadMore({ userId: receiverId, before: oldestId }).unwrap();
      dispatch(
        messageApi.util.updateQueryData("getMessages", receiverId, (draft) => {
          const existingIds = new Set(draft.messages.map((m) => m._id));
          const older = result.messages.filter((m) => !existingIds.has(m._id));
          draft.messages = [...older, ...draft.messages];
          draft.hasMore = result.hasMore;
        }),
      );
      setHasMore(result.hasMore);
    } finally {
      isLoadingMoreRef.current = false;
    }
  };

  const statusText = isTyping
    ? "typing..."
    : isOnline
      ? "Active now"
      : lastSeen
        ? `Active ${formatMessageTime(lastSeen)}`
        : "Offline";

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      <div className="h-16 border-b border-border flex items-center justify-between px-4 shrink-0">
        <Link to={`/user/${user?._id}`} className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="w-10 h-10">
              <AvatarImage src={user?.avatar} />
              <AvatarFallback>{user?.fullName?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            {isOnline && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background" />
            )}
          </div>
          <div>
            <p className="font-semibold text-sm">{user?.fullName}</p>
            <p className={cn("text-xs", isTyping ? "text-primary" : "text-muted-foreground")}>
              {statusText}
            </p>
          </div>
        </Link>
      </div>

      <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
        <div className="flex flex-col p-4">
          {hasMore && (
            <div className="flex justify-center mb-4">
              <Button variant="ghost" size="sm" onClick={handleLoadMore}>
                Load older messages
              </Button>
            </div>
          )}

          {messagesLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-48 rounded-2xl" />
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Avatar className="w-20 h-20 mb-3">
                <AvatarImage src={user?.avatar} />
                <AvatarFallback>{user?.fullName?.[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <p className="font-semibold">{user?.fullName}</p>
              <p className="text-sm text-muted-foreground">Say hi 👋</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isSender =
                typeof msg.senderId === "string"
                  ? msg.senderId === userId
                  : msg.senderId._id === userId;

              return (
                <MessageBubble
                  key={msg._id}
                  message={msg}
                  isSender={isSender}
                  receiverAvatar={user?.avatar || ""}
                  onRetry={
                    msg.status === "failed"
                      ? () =>
                          sendMsg({
                            receiverId: receiverId!,
                            message: msg.message,
                            clientId: msg.clientId,
                          })
                      : undefined
                  }
                />
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border shrink-0">
        <div className="flex items-center gap-2 bg-muted rounded-full px-4 py-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <Smile className="w-5 h-5 text-muted-foreground" />
          </Button>
          <Input
            value={text}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Message..."
            className="border-none shadow-none bg-transparent focus-visible:ring-0"
          />
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8 shrink-0", text.trim() && "text-primary")}
            onClick={sendMessage}
            disabled={!text.trim() || isSending}
          >
            {isSending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
