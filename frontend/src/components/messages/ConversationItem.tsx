import { Link } from "react-router-dom";
import { VolumeX } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { formatMessageTime } from "@/lib/date";
import { Conversation } from "@/services/messageApi";
import { useSelector } from "react-redux";
import {
  selectIsUserOnline,
  selectUserLastSeen,
  selectTypingByConversation,
} from "@/store/messagingSlice";
import type { RootState } from "@/store/store";

interface ConversationItemProps {
  conversation: Conversation;
  isActive?: boolean;
}

export function ConversationItem({ conversation, isActive = false }: ConversationItemProps) {
  const chatUser = conversation.user;
  const typingByConversation = useSelector(selectTypingByConversation);
  const isOnline = useSelector((state: RootState) =>
    selectIsUserOnline(state, chatUser._id),
  );
  const liveLastSeen = useSelector((state: RootState) =>
    selectUserLastSeen(state, chatUser._id),
  );

  const isTyping = !!typingByConversation[conversation._id];
  const lastSeen = liveLastSeen || conversation.lastSeen;

  const preview = isTyping
    ? "typing..."
    : conversation.lastMessage?.message || "Start chatting";

  return (
    <Link
      to={`/chat/${chatUser._id}`}
      className={cn(
        "flex items-center gap-3 p-3 mx-2 rounded-lg hover:bg-muted/50 transition-colors",
        isActive && "bg-muted",
        conversation.unreadCount > 0 && "bg-muted/30",
      )}
    >
      <div className="relative">
        <Avatar className="w-14 h-14">
          <AvatarImage src={chatUser.avatar} />
          <AvatarFallback>{chatUser.username.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        {isOnline && (
          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-background" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={cn("font-semibold text-sm truncate", conversation.unreadCount > 0 && "text-foreground")}>
            {chatUser.username}
          </p>
          {conversation.lastMessage && (
            <span className="text-xs text-muted-foreground shrink-0">
              {formatMessageTime(conversation.lastMessage.createdAt)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {conversation.muted && <VolumeX className="h-3 w-3 text-muted-foreground shrink-0" />}
          <p
            className={cn(
              "text-sm truncate",
              isTyping ? "text-primary italic" : "text-muted-foreground",
              conversation.unreadCount > 0 && !isTyping && "font-medium text-foreground",
            )}
          >
            {preview}
          </p>
        </div>

        {!isOnline && lastSeen && !isTyping && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Active {formatMessageTime(lastSeen)}
          </p>
        )}
      </div>

      {conversation.unreadCount > 0 && (
        <span className="min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0">
          {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
        </span>
      )}
    </Link>
  );
}
