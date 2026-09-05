import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface PresenceEntry {
  status: "online" | "offline";
  lastSeen: string | null;
}

interface MessagingState {
  onlineUsers: string[];
  presence: Record<string, PresenceEntry>;
  typingByConversation: Record<string, string | null>;
  activeConversationId: string | null;
  activeChatUserId: string | null;
}

const initialState: MessagingState = {
  onlineUsers: [],
  presence: {},
  typingByConversation: {},
  activeConversationId: null,
  activeChatUserId: null,
};

export const normalizeUserId = (
  userId: string | { _id?: string } | null | undefined,
): string | null => {
  if (!userId) return null;
  if (typeof userId === "string") return userId;
  return userId._id ? String(userId._id) : null;
};

const normalizeUserIdList = (userIds: string[]): string[] =>
  [...new Set(userIds.map((id) => String(id)).filter(Boolean))];

const syncOnlinePresenceMap = (
  state: MessagingState,
  onlineUserIds: string[],
) => {
  for (const userId of onlineUserIds) {
    state.presence[userId] = {
      status: "online",
      lastSeen: state.presence[userId]?.lastSeen ?? null,
    };
  }
};

const messagingSlice = createSlice({
  name: "messaging",
  initialState,
  reducers: {
    setOnlineUsers: (state, action: PayloadAction<string[]>) => {
      state.onlineUsers = normalizeUserIdList(action.payload);
      syncOnlinePresenceMap(state, state.onlineUsers);
    },
    setPresenceUpdate: (
      state,
      action: PayloadAction<{ userId: string; status: "online" | "offline"; lastSeen?: string }>,
    ) => {
      const userId = normalizeUserId(action.payload.userId);
      if (!userId) return;

      const { status, lastSeen } = action.payload;
      const normalizedLastSeen = lastSeen
        ? String(lastSeen)
        : state.presence[userId]?.lastSeen ?? null;

      state.presence[userId] = {
        status,
        lastSeen: normalizedLastSeen,
      };

      if (status === "online") {
        if (!state.onlineUsers.includes(userId)) {
          state.onlineUsers.push(userId);
        }
        return;
      }

      state.onlineUsers = state.onlineUsers.filter((id) => id !== userId);
    },
    setTyping: (
      state,
      action: PayloadAction<{ conversationId: string; userId: string | null }>,
    ) => {
      state.typingByConversation[action.payload.conversationId] =
        action.payload.userId;
    },
    setActiveChat: (
      state,
      action: PayloadAction<{ conversationId: string | null; userId: string | null }>,
    ) => {
      state.activeConversationId = action.payload.conversationId;
      state.activeChatUserId = action.payload.userId;
    },
    resetMessaging: () => initialState,
  },
});

export const {
  setOnlineUsers,
  setPresenceUpdate,
  setTyping,
  setActiveChat,
  resetMessaging,
} = messagingSlice.actions;

export const selectOnlineUsers = (state: { messaging: MessagingState }) =>
  state.messaging.onlineUsers;

export const selectPresence = (state: { messaging: MessagingState }) =>
  state.messaging.presence;

export const selectIsUserOnline = (
  state: { messaging: MessagingState },
  userId: string | { _id?: string } | null | undefined,
): boolean => {
  const normalized = normalizeUserId(userId);
  if (!normalized) return false;

  if (state.messaging.onlineUsers.includes(normalized)) {
    return true;
  }

  return state.messaging.presence[normalized]?.status === "online";
};

export const selectUserLastSeen = (
  state: { messaging: MessagingState },
  userId: string | { _id?: string } | null | undefined,
): string | null => {
  const normalized = normalizeUserId(userId);
  if (!normalized) return null;
  return state.messaging.presence[normalized]?.lastSeen ?? null;
};

export const selectTypingByConversation = (state: { messaging: MessagingState }) =>
  state.messaging.typingByConversation;

export const selectActiveChatUserId = (state: { messaging: MessagingState }) =>
  state.messaging.activeChatUserId;

export const selectActiveConversationId = (state: { messaging: MessagingState }) =>
  state.messaging.activeConversationId;

export default messagingSlice.reducer;
