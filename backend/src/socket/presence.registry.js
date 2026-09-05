/**
 * In-memory presence registry.
 * For multi-instance production, replace with Redis adapter + shared store.
 */

const userSockets = new Map(); // userId -> Set<socketId>
const socketUsers = new Map(); // socketId -> userId
const typingUsers = new Map(); // `${conversationId}:${userId}` -> timeoutId

export const addUserSocket = (userId, socketId) => {
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId).add(socketId);
  socketUsers.set(socketId, userId);
};

export const removeUserSocket = (socketId) => {
  const userId = socketUsers.get(socketId);
  if (!userId) return null;

  const sockets = userSockets.get(userId);
  if (sockets) {
    sockets.delete(socketId);
    if (sockets.size === 0) {
      userSockets.delete(userId);
    }
  }
  socketUsers.delete(socketId);
  return userId;
};

export const getUserSocketIds = (userId) =>
  userSockets.get(userId?.toString()) || new Set();

export const isUserOnline = (userId) =>
  getUserSocketIds(userId?.toString()).size > 0;

export const getOnlineUserIds = () => Array.from(userSockets.keys());

export const emitToUser = (io, userId, event, payload) => {
  const normalizedUserId = userId?.toString();
  if (!normalizedUserId) return;

  io.to(`user:${normalizedUserId}`).emit(event, payload);
};

export const setTyping = (conversationId, userId, callback, timeoutMs = 3000) => {
  const key = `${conversationId}:${userId}`;
  if (typingUsers.has(key)) {
    clearTimeout(typingUsers.get(key));
  }
  const timeoutId = setTimeout(() => {
    typingUsers.delete(key);
    callback(false);
  }, timeoutMs);
  typingUsers.set(key, timeoutId);
  callback(true);
};

export const clearTyping = (conversationId, userId) => {
  const key = `${conversationId}:${userId}`;
  if (typingUsers.has(key)) {
    clearTimeout(typingUsers.get(key));
    typingUsers.delete(key);
  }
};
