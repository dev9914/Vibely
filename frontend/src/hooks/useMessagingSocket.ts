import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { Socket } from "socket.io-client";
import { connectSocketWithAuth, disconnectSocket, getSocket, startSocket } from "@/lib/socket";
import { SOCKET_EVENTS } from "@/lib/constants";
import { messageApi, Message } from "@/services/messageApi";
import { getMessageUserId, messageExistsInList } from "@/lib/messageUtils";
import { selectIsAuthenticated, selectUser } from "@/store/authSlice";
import {
  setOnlineUsers,
  setPresenceUpdate,
  setTyping,
  resetMessaging,
  selectActiveChatUserId,
  selectActiveConversationId,
} from "@/store/messagingSlice";
import type { AppDispatch, RootState } from "@/store/store";

/**
 * Global messaging socket — connects once on auth and keeps
 * conversation list + unread counts in sync app-wide.
 */
export function useMessagingSocket() {
  const dispatch = useDispatch<AppDispatch>();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const currentUser = useSelector(selectUser);
  const activeChatUserId = useSelector(selectActiveChatUserId);
  const activeConversationId = useSelector(selectActiveConversationId);

  const activeChatRef = useRef(activeChatUserId);
  const activeConversationRef = useRef(activeConversationId);
  const currentUserRef = useRef(currentUser);
  activeChatRef.current = activeChatUserId;
  activeConversationRef.current = activeConversationId;
  currentUserRef.current = currentUser;

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
      dispatch(resetMessaging());
      return;
    }

    let cancelled = false;
    let socket: Socket | null = null;

    const markConversationRead = (conversationId: string) => {
      dispatch(
        messageApi.util.updateQueryData("getConversations", undefined, (draft) => {
          const conversation = draft?.conversations?.find((c) => c._id === conversationId);
          if (conversation) conversation.unreadCount = 0;
        }),
      );
      dispatch(messageApi.endpoints.markMessagesAsRead.initiate(conversationId));
      getSocket()?.emit(SOCKET_EVENTS.MESSAGE_SEEN, { conversationId });
    };

    const isChatOpenWith = (userId: string) => activeChatRef.current === userId;

    const upsertIncomingMessage = (otherUserId: string, message: Message, conversationId: string) => {
      dispatch((_, getState) => {
        const state = getState() as RootState;
        const cached = messageApi.endpoints.getMessages.select(otherUserId)(state);

        if (cached?.data?.messages) {
          dispatch(
            messageApi.util.updateQueryData("getMessages", otherUserId, (draft) => {
              if (!draft?.messages) return;
              if (!messageExistsInList(draft.messages, message)) {
                draft.messages.push(message);
              }
              if (!draft.conversationId) {
                draft.conversationId = conversationId;
              }
            }),
          );
          return;
        }

        dispatch(
          messageApi.util.upsertQueryData("getMessages", otherUserId, {
            messages: [message],
            hasMore: false,
            conversationId,
          }),
        );
      });
    };

    const handleOnlineUsers = (users: string[]) => {
      dispatch(setOnlineUsers(users));
    };

    const handlePresence = (payload: {
      userId: string;
      status: "online" | "offline";
      lastSeen?: string;
    }) => {
      dispatch(setPresenceUpdate(payload));
    };

    const handleNewMessage = (payload: {
      message: Message;
      conversationId: string;
    }) => {
      const message = payload.message;
      const senderId = getMessageUserId(message.senderId);
      const receiverId = getMessageUserId(message.receiverId);
      const currentUserId = currentUserRef.current?._id;

      const otherUserId =
        senderId === currentUserId ? receiverId : senderId;

      const chatOpenWithSender = isChatOpenWith(senderId);
      const isOwnMessage = senderId === currentUserId;

      if (!isOwnMessage && otherUserId) {
        upsertIncomingMessage(otherUserId, message, payload.conversationId);
      }

      dispatch(
        messageApi.util.updateQueryData("getConversations", undefined, (draft) => {
          if (!draft?.conversations) return;

          const existing = draft.conversations.find(
            (c) => c._id === payload.conversationId,
          );

          const lastMessage = {
            _id: message._id,
            message: message.message,
            senderId: message.senderId,
            type: message.type,
            createdAt: message.createdAt,
          };

          if (existing) {
            existing.lastMessage = lastMessage;
            existing.updatedAt = message.createdAt;

            if (chatOpenWithSender || isChatOpenWith(otherUserId)) {
              existing.unreadCount = 0;
            } else if (!isOwnMessage) {
              existing.unreadCount = (existing.unreadCount || 0) + 1;
            }
          } else {
            dispatch(
              messageApi.util.invalidateTags([{ type: "Conversation", id: "LIST" }]),
            );
          }
        }),
      );

      if (chatOpenWithSender && payload.conversationId) {
        markConversationRead(payload.conversationId);
      } else if (!isOwnMessage) {
        dispatch(
          messageApi.util.invalidateTags([{ type: "Message", id: "UNREAD_COUNT" }]),
        );
      }

      if (
        !isOwnMessage &&
        !chatOpenWithSender &&
        document.hidden &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        const senderName =
          typeof message.senderId === "object"
            ? message.senderId.username
            : "Someone";
        new Notification(`${senderName} sent a message`, {
          body: message.message || "New message",
          tag: payload.conversationId,
        });
      }
    };

    const handleConversationUpdate = (payload: {
      conversationId: string;
      lastMessage?: {
        messageId?: string;
        text?: string;
        senderId?: string;
        type?: string;
        createdAt?: string;
      };
      unreadCount?: number;
    }) => {
      dispatch(
        messageApi.util.updateQueryData("getConversations", undefined, (draft) => {
          if (!draft?.conversations) return;

          const existing = draft.conversations.find(
            (c) => c._id === payload.conversationId,
          );
          if (!existing) return;

          if (payload.lastMessage) {
            existing.lastMessage = {
              _id: payload.lastMessage.messageId || "",
              message: payload.lastMessage.text || "",
              senderId: payload.lastMessage.senderId as Message["senderId"],
              type: payload.lastMessage.type as Message["type"],
              createdAt: payload.lastMessage.createdAt || new Date().toISOString(),
            };
            existing.updatedAt = payload.lastMessage.createdAt || existing.updatedAt;
          }

          const chatOpenWithUser = isChatOpenWith(existing.user._id);
          existing.unreadCount = chatOpenWithUser ? 0 : (payload.unreadCount ?? existing.unreadCount);
        }),
      );

      if (!isChatOpenWith(activeChatRef.current || "")) {
        dispatch(
          messageApi.util.invalidateTags([{ type: "Message", id: "UNREAD_COUNT" }]),
        );
      }
    };

    const handleMessageDelivered = (payload: {
      messageId: string;
      deliveredAt: string;
    }) => {
      if (!activeChatRef.current) return;
      dispatch(
        messageApi.util.updateQueryData(
          "getMessages",
          activeChatRef.current,
          (draft) => {
            const msg = draft?.messages?.find((m) => m._id === payload.messageId);
            if (msg) {
              msg.status = "delivered";
              msg.deliveredAt = payload.deliveredAt;
            }
          },
        ),
      );
    };

    const handleMessageSeen = (payload: {
      conversationId: string;
      seenAt: string;
    }) => {
      if (!activeChatRef.current) return;
      dispatch(
        messageApi.util.updateQueryData(
          "getMessages",
          activeChatRef.current,
          (draft) => {
            draft?.messages?.forEach((msg) => {
              if (
                getMessageUserId(msg.senderId) === currentUserRef.current?._id &&
                msg.status !== "seen"
              ) {
                msg.status = "seen";
                msg.seenAt = payload.seenAt;
              }
            });
          },
        ),
      );
    };

    const handleMessageDelete = (payload: { messageId: string; scope: string }) => {
      if (!activeChatRef.current) return;
      dispatch(
        messageApi.util.updateQueryData(
          "getMessages",
          activeChatRef.current,
          (draft) => {
            if (!draft?.messages) return;
            if (payload.scope === "everyone") {
              const msg = draft.messages.find((m) => m._id === payload.messageId);
              if (msg) msg.message = "This message was deleted";
            } else {
              draft.messages = draft.messages.filter((m) => m._id !== payload.messageId);
            }
          },
        ),
      );
    };

    const handleTypingStart = (payload: { conversationId: string; userId: string }) => {
      dispatch(
        setTyping({ conversationId: payload.conversationId, userId: payload.userId }),
      );
    };

    const handleTypingStop = (payload: { conversationId: string }) => {
      dispatch(setTyping({ conversationId: payload.conversationId, userId: null }));
    };

    const attachListeners = (activeSocket: Socket) => {
      activeSocket.on(SOCKET_EVENTS.ONLINE_USERS, handleOnlineUsers);
      activeSocket.on(SOCKET_EVENTS.PRESENCE_UPDATE, handlePresence);
      activeSocket.on(SOCKET_EVENTS.MESSAGE_NEW, handleNewMessage);
      activeSocket.on(SOCKET_EVENTS.CONVERSATION_UPDATE, handleConversationUpdate);
      activeSocket.on(SOCKET_EVENTS.MESSAGE_DELIVERED, handleMessageDelivered);
      activeSocket.on(SOCKET_EVENTS.MESSAGE_SEEN, handleMessageSeen);
      activeSocket.on(SOCKET_EVENTS.MESSAGE_DELETE, handleMessageDelete);
      activeSocket.on(SOCKET_EVENTS.TYPING_START, handleTypingStart);
      activeSocket.on(SOCKET_EVENTS.TYPING_STOP, handleTypingStop);
    };

    const detachListeners = (activeSocket: Socket) => {
      activeSocket.off(SOCKET_EVENTS.ONLINE_USERS, handleOnlineUsers);
      activeSocket.off(SOCKET_EVENTS.PRESENCE_UPDATE, handlePresence);
      activeSocket.off(SOCKET_EVENTS.MESSAGE_NEW, handleNewMessage);
      activeSocket.off(SOCKET_EVENTS.CONVERSATION_UPDATE, handleConversationUpdate);
      activeSocket.off(SOCKET_EVENTS.MESSAGE_DELIVERED, handleMessageDelivered);
      activeSocket.off(SOCKET_EVENTS.MESSAGE_SEEN, handleMessageSeen);
      activeSocket.off(SOCKET_EVENTS.MESSAGE_DELETE, handleMessageDelete);
      activeSocket.off(SOCKET_EVENTS.TYPING_START, handleTypingStart);
      activeSocket.off(SOCKET_EVENTS.TYPING_STOP, handleTypingStop);
    };

    const setup = async () => {
      const connectedSocket = await connectSocketWithAuth();
      if (cancelled || !connectedSocket) return;

      socket = connectedSocket;
      attachListeners(socket);
      startSocket(socket);
    };

    void setup();

    return () => {
      cancelled = true;
      if (socket) {
        detachListeners(socket);
      }
    };
  }, [dispatch, isAuthenticated, currentUser?._id]);
}

export const emitTypingStart = (conversationId: string, receiverId: string) => {
  getSocket()?.emit(SOCKET_EVENTS.TYPING_START, { conversationId, receiverId });
};

export const emitTypingStop = (conversationId: string, receiverId: string) => {
  getSocket()?.emit(SOCKET_EVENTS.TYPING_STOP, { conversationId, receiverId });
};

export const emitMessageSeen = (conversationId: string) => {
  getSocket()?.emit(SOCKET_EVENTS.MESSAGE_SEEN, { conversationId });
};
