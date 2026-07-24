import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import {
  emitToUser,
  isUserOnline,
} from "../socket/presence.registry.js";
import { enqueueNotificationJob } from "../../queues/notification.queue.js";

const MESSAGE_LIMIT = 30;
const USER_SELECT = "username fullName avatar";

const buildParticipantKey = (userA, userB) =>
  [userA.toString(), userB.toString()].sort().join(":");

const ensureParticipantSettings = (conversation, userIds) => {
  const existing = new Set(
    conversation.participantSettings.map((s) => s.userId.toString()),
  );

  for (const userId of userIds) {
    if (!existing.has(userId.toString())) {
      conversation.participantSettings.push({
        userId,
        unreadCount: 0,
        muted: false,
        archived: false,
        lastReadAt: null,
      });
    }
  }
};

const getOtherParticipant = (conversation, currentUserId) =>
  conversation.participants.find(
    (participant) => participant._id.toString() !== currentUserId.toString(),
  );

const getParticipantSetting = (conversation, userId) =>
  conversation.participantSettings.find(
    (setting) => setting.userId.toString() === userId.toString(),
  );

const populateMessage = (messageDoc) =>
  Message.populate(messageDoc, [
    { path: "senderId", select: USER_SELECT },
    { path: "receiverId", select: USER_SELECT },
    {
      path: "replyTo",
      select: "message senderId type attachments",
      populate: { path: "senderId", select: USER_SELECT },
    },
  ]);

export const findOrCreateConversation = async (senderId, receiverId) => {
  const participantKey = buildParticipantKey(senderId, receiverId);

  let conversation = await Conversation.findOne({
    $or: [{ participantKey }, { participants: { $all: [senderId, receiverId] } }],
  });

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [senderId, receiverId],
      participantKey,
      participantSettings: [
        { userId: senderId, unreadCount: 0 },
        { userId: receiverId, unreadCount: 0 },
      ],
      messages: [],
    });
  } else if (!conversation.participantKey) {
    conversation.participantKey = participantKey;
    ensureParticipantSettings(conversation, [senderId, receiverId]);
    await conversation.save();
  } else {
    ensureParticipantSettings(conversation, [senderId, receiverId]);
  }

  return conversation;
};

export const sendMessage = async ({
  senderId,
  receiverId,
  content,
  type = "text",
  attachments = [],
  replyTo = null,
  clientId = null,
  io,
}) => {
  if (senderId.toString() === receiverId.toString()) {
    throw new ApiError(400, "You cannot send messages to yourself");
  }

  const receiver = await User.findById(receiverId).select("_id");
  if (!receiver) {
    throw new ApiError(404, "Receiver not found");
  }

  const trimmed = content?.trim() || "";
  if (!trimmed && attachments.length === 0) {
    throw new ApiError(400, "Message content cannot be empty");
  }

  const conversation = await findOrCreateConversation(senderId, receiverId);

  const message = await Message.create({
    conversationId: conversation._id,
    senderId,
    receiverId,
    message: trimmed,
    type,
    attachments,
    replyTo,
    clientId,
    status: "sent",
  });

  conversation.messages.push(message._id);
  conversation.lastMessage = {
    messageId: message._id,
    text: trimmed || (attachments[0]?.type === "image" ? "📷 Photo" : "Attachment"),
    senderId,
    type,
    createdAt: message.createdAt,
  };
  conversation.updatedAt = new Date();

  const receiverSetting = getParticipantSetting(conversation, receiverId);
  if (receiverSetting) {
    receiverSetting.unreadCount += 1;
  }

  ensureParticipantSettings(conversation, [senderId, receiverId]);
  await conversation.save();

  const populatedMessage = await populateMessage(message);

  if (isUserOnline(receiverId.toString())) {
    populatedMessage.status = "delivered";
    populatedMessage.deliveredAt = new Date();
    await Message.findByIdAndUpdate(message._id, {
      status: "delivered",
      deliveredAt: populatedMessage.deliveredAt,
    });

    if (io) {
      emitToUser(io, receiverId.toString(), "message:delivered", {
        messageId: message._id,
        conversationId: conversation._id,
        deliveredAt: populatedMessage.deliveredAt,
      });
    }
  }

  const payload = {
    message: populatedMessage,
    conversationId: conversation._id,
  };

  if (io) {
    emitToUser(io, receiverId.toString(), "message:new", payload);
    emitToUser(io, senderId.toString(), "message:new", payload);
    emitToUser(io, receiverId.toString(), "conversation:update", {
      conversationId: conversation._id,
      lastMessage: conversation.lastMessage,
      unreadCount: receiverSetting?.unreadCount ?? 1,
    });
    emitToUser(io, senderId.toString(), "conversation:update", {
      conversationId: conversation._id,
      lastMessage: conversation.lastMessage,
      unreadCount: 0,
    });
  }

  // Send push notification for new chat message
  try {
    const sender = await User.findById(senderId).select("username fullName avatar");
    await enqueueNotificationJob(receiverId, {
      sender: senderId,
      type: "message",
      title: `${sender?.username || "Someone"} sent you a message`,
      message: trimmed || (attachments[0]?.type === "image" ? "📷 Photo" : "Attachment"),
      actionUrl: `/chat/${senderId}`,
      relatedResource: {
        resourceType: "user",
        resourceId: senderId,
      },
    });
  } catch (error) {
    console.error("Error sending chat notification:", error);
  }

  return payload;
};

export const getMessages = async ({
  currentUserId,
  otherUserId,
  limit = MESSAGE_LIMIT,
  before,
}) => {
  const conversation = await Conversation.findOne({
    participants: { $all: [currentUserId, otherUserId] },
  });

  if (!conversation) {
    return { messages: [], hasMore: false, conversationId: null };
  }

  const query = {
    conversationId: conversation._id,
    deletedFor: { $ne: currentUserId },
    deletedForEveryone: { $ne: true },
  };

  if (before) {
    const cursorMessage = await Message.findById(before).select("createdAt");
    if (cursorMessage) {
      query.createdAt = { $lt: cursorMessage.createdAt };
    }
  }

  let messages = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(limit + 1)
    .populate("senderId", USER_SELECT)
    .populate("receiverId", USER_SELECT)
    .populate({
      path: "replyTo",
      select: "message senderId type attachments",
      populate: { path: "senderId", select: USER_SELECT },
    })
    .lean();

  // Fallback for legacy messages without conversationId
  if (messages.length === 0 && !before) {
    messages = await Message.find({
      $or: [
        { senderId: currentUserId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: currentUserId },
      ],
      deletedFor: { $ne: currentUserId },
      deletedForEveryone: { $ne: true },
    })
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .populate("senderId", USER_SELECT)
      .populate("receiverId", USER_SELECT)
      .lean();
  }

  const hasMore = messages.length > limit;
  if (hasMore) messages.pop();

  return {
    messages: messages.reverse(),
    hasMore,
    conversationId: conversation._id,
  };
};

export const getConversations = async (currentUserId) => {
  const conversations = await Conversation.find({
    participants: currentUserId,
    "participantSettings": {
      $not: {
        $elemMatch: { userId: currentUserId, archived: true },
      },
    },
  })
    .populate("participants", USER_SELECT)
    .sort({ updatedAt: -1 })
    .lean();

  const onlineUsers = await User.find({
    _id: { $in: conversations.flatMap((c) => c.participants.map((p) => p._id)) },
  })
    .select("lastSeen")
    .lean();

  const lastSeenMap = Object.fromEntries(
    onlineUsers.map((u) => [u._id.toString(), u.lastSeen]),
  );

  const formatted = conversations.map((conversation) => {
    const otherUser = getOtherParticipant(conversation, currentUserId);
    const setting = conversation.participantSettings?.find(
      (s) => s.userId.toString() === currentUserId.toString(),
    );

    return {
      _id: conversation._id,
      user: otherUser,
      lastMessage: conversation.lastMessage
        ? {
            _id: conversation.lastMessage.messageId,
            message: conversation.lastMessage.text,
            senderId: conversation.lastMessage.senderId,
            type: conversation.lastMessage.type,
            createdAt: conversation.lastMessage.createdAt,
          }
        : null,
      unreadCount: setting?.unreadCount ?? 0,
      muted: setting?.muted ?? false,
      updatedAt: conversation.updatedAt,
      lastSeen: otherUser ? lastSeenMap[otherUser._id.toString()] : null,
    };
  });

  formatted.sort((a, b) => {
    if (a.unreadCount !== b.unreadCount) return b.unreadCount - a.unreadCount;
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  return formatted;
};

export const markConversationAsRead = async ({
  conversationId,
  userId,
  io,
}) => {
  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: userId,
  });

  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }

  const setting = getParticipantSetting(conversation, userId);
  if (setting) {
    setting.unreadCount = 0;
    setting.lastReadAt = new Date();
  }

  await conversation.save();

  const now = new Date();
  await Message.updateMany(
    {
      conversationId,
      receiverId: userId,
      seenAt: null,
    },
    {
      status: "seen",
      seenAt: now,
      deliveredAt: now,
    },
  );

  const otherUser = conversation.participants.find(
    (id) => id.toString() !== userId.toString(),
  );

  if (io && otherUser) {
    emitToUser(io, otherUser.toString(), "message:seen", {
      conversationId,
      seenAt: now,
      seenBy: userId,
    });
  }

  return { success: true };
};

export const getUnreadCount = async (userId) => {
  const conversations = await Conversation.find({ participants: userId }).select(
    "participantSettings",
  );

  const count = conversations.reduce((total, conversation) => {
    const setting = getParticipantSetting(conversation, userId);
    return total + (setting?.unreadCount ?? 0);
  }, 0);

  return count;
};

export const deleteMessage = async ({
  messageId,
  userId,
  scope = "me",
  io,
}) => {
  const message = await Message.findById(messageId);
  if (!message) {
    throw new ApiError(404, "Message not found");
  }

  const isParticipant =
    message.senderId.toString() === userId.toString() ||
    message.receiverId.toString() === userId.toString();

  if (!isParticipant) {
    throw new ApiError(403, "Not authorized to delete this message");
  }

  if (scope === "everyone") {
    if (message.senderId.toString() !== userId.toString()) {
      throw new ApiError(403, "Only the sender can delete for everyone");
    }
    message.deletedForEveryone = true;
    message.message = "This message was deleted";
    message.attachments = [];
  } else {
    if (!message.deletedFor.some((id) => id.toString() === userId.toString())) {
      message.deletedFor.push(userId);
    }
  }

  await message.save();

  const recipientId =
    message.senderId.toString() === userId.toString()
      ? message.receiverId.toString()
      : message.senderId.toString();

  if (io) {
    emitToUser(io, recipientId, "message:delete", {
      messageId,
      scope,
      conversationId: message.conversationId,
    });
    emitToUser(io, userId.toString(), "message:delete", {
      messageId,
      scope,
      conversationId: message.conversationId,
    });
  }

  return { success: true };
};

export const updateConversationSettings = async ({
  conversationId,
  userId,
  muted,
  archived,
}) => {
  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: userId,
  });

  if (!conversation) {
    throw new ApiError(404, "Conversation not found");
  }

  ensureParticipantSettings(conversation, [userId]);
  const setting = getParticipantSetting(conversation, userId);

  if (typeof muted === "boolean") setting.muted = muted;
  if (typeof archived === "boolean") setting.archived = archived;

  await conversation.save();
  return { success: true, muted: setting.muted, archived: setting.archived };
};
