import crypto from "crypto";
import mongoose from "mongoose";
import { Notification, SOCIAL_NOTIFICATION_TYPES } from "../../models/notification.model.js";
import { User } from "../../models/user.models.js";
import { sendPushToUser } from "./fcm.service.js";
import { getIo } from "../../socket/io.ref.js";
import { emitToUser } from "../../socket/presence.registry.js";

const MAX_GROUPED_ACTORS = 25;

const assertMongoReady = () => {
  if (mongoose.connection.readyState !== 1) {
    throw new Error(
      `MongoDB is not connected in notification service (readyState=${mongoose.connection.readyState})`,
    );
  }
};

const isTransientMongoError = (error) => {
  const message = error?.message || "";
  return (
    message.includes("buffering timed out") ||
    message.includes("timed out") ||
    message.includes("ECONNRESET") ||
    message.includes("MongoNetworkError")
  );
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const toObjectIdOrNull = (value) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  return mongoose.Types.ObjectId.isValid(value)
    ? new mongoose.Types.ObjectId(value)
    : null;
};

const normalizeType = (type) => {
  if (type === "story") return "story_like";
  return type;
};

const normalizeNotificationPayload = (receiverId, data) => {
  const type = normalizeType(data?.type);
  const actor = toObjectIdOrNull(data?.actor || data?.sender);
  const receiver = toObjectIdOrNull(receiverId || data?.receiver || data?.recipient);
  const relatedPost = toObjectIdOrNull(
    data?.relatedPost ||
      (data?.relatedResource?.resourceType === "post"
        ? data.relatedResource.resourceId
        : null),
  );
  const relatedStory = toObjectIdOrNull(
    data?.relatedStory ||
      (data?.relatedResource?.resourceType === "story"
        ? data.relatedResource.resourceId
        : null),
  );

  if (!receiver || !actor || !type) {
    throw new Error("Notification payload missing receiver, actor, or type");
  }

  return {
    receiver,
    actor,
    type,
    relatedPost,
    relatedStory,
    title: data?.title?.trim?.() || "",
    message: data?.message?.trim?.() || "",
    actionUrl: data?.actionUrl?.trim?.() || "",
    metadata: data?.metadata || data?.data || {},
  };
};

const shouldGroupNotification = (type) =>
  type === "like" || type === "comment" || type === "story_like";

const isSocialNotificationType = (type) =>
  SOCIAL_NOTIFICATION_TYPES.includes(type);

const buildGroupingQuery = (payload) => {
  if (!shouldGroupNotification(payload.type)) {
    return null;
  }

  if (payload.relatedPost) {
    return {
      receiver: payload.receiver,
      type: payload.type,
      relatedPost: payload.relatedPost,
    };
  }

  if (payload.relatedStory) {
    return {
      receiver: payload.receiver,
      type: payload.type,
      relatedStory: payload.relatedStory,
    };
  }

  return null;
};

const mapUser = (user) => {
  if (!user) return null;
  return {
    _id: String(user._id),
    username: user.username,
    fullName: user.fullName,
    avatar: user.avatar,
  };
};

const getPreviewImage = (notification) => {
  if (Array.isArray(notification.relatedPost?.postImage) && notification.relatedPost.postImage.length > 0) {
    return notification.relatedPost.postImage[0];
  }

  if (notification.relatedStory?.media?.url) {
    return notification.relatedStory.media.url;
  }

  return null;
};

const formatNotification = (notification) => {
  const actors = Array.isArray(notification.actors)
    ? notification.actors.map(mapUser).filter(Boolean)
    : [];
  const actor = mapUser(notification.actor) || actors[0] || null;

  return {
    _id: String(notification._id),
    actor,
    actors,
    actorCount: Math.max(notification.actorCount || actors.length || 1, actors.length || 1),
    receiver: String(notification.receiver?._id || notification.receiver),
    type: notification.type,
    relatedPost: notification.relatedPost?._id
      ? String(notification.relatedPost._id)
      : notification.relatedPost
        ? String(notification.relatedPost)
        : null,
    relatedStory: notification.relatedStory?._id
      ? String(notification.relatedStory._id)
      : notification.relatedStory
        ? String(notification.relatedStory)
        : null,
    title: notification.title || "",
    message: notification.message || "",
    actionUrl: notification.actionUrl || "",
    previewImage: getPreviewImage(notification),
    isRead: Boolean(notification.isRead),
    readAt: notification.readAt || null,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
  };
};

const emitNotificationCreated = async (receiverId, notificationDoc) => {
  const io = getIo();
  if (!io) return;

  const unreadCount = await Notification.getUnreadCount(receiverId);
  emitToUser(io, receiverId, "newNotification", {
    notification: formatNotification(notificationDoc),
    unreadCount,
  });
};

const hydrateNotificationDoc = async (notificationId) => {
  return Notification.findById(notificationId)
    .populate("actor", "username fullName avatar")
    .populate("actors", "username fullName avatar")
    .populate("relatedPost", "postImage")
    .populate("relatedStory", "media")
    .lean();
};

export const createNotification = async (data) => {
  const payload = normalizeNotificationPayload(data?.receiver || data?.recipient, data);

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      assertMongoReady();

      const groupingQuery = buildGroupingQuery(payload);
      let notification;

      if (groupingQuery) {
        notification = await Notification.findOne(groupingQuery);
      }

      if (notification) {
        const actorId = String(payload.actor);
        const currentActors = Array.isArray(notification.actors) ? notification.actors : [];
        const alreadyPresent = currentActors.some((id) => String(id) === actorId);
        const reorderedActors = [
          payload.actor,
          ...currentActors.filter((id) => String(id) !== actorId),
        ].slice(0, MAX_GROUPED_ACTORS);

        notification.actor = payload.actor;
        notification.actors = reorderedActors;
        notification.actorCount = alreadyPresent
          ? Math.max(notification.actorCount || currentActors.length || 1, currentActors.length || 1)
          : Math.max((notification.actorCount || currentActors.length || 0) + 1, reorderedActors.length);
        notification.title = payload.title || notification.title;
        notification.message = payload.message || notification.message;
        notification.actionUrl = payload.actionUrl || notification.actionUrl;
        notification.metadata = {
          ...(notification.metadata || {}),
          ...(payload.metadata || {}),
        };
        notification.isRead = false;
        notification.readAt = null;

        await notification.save();
      } else {
        notification = await Notification.create({
          ...payload,
          actors: [payload.actor],
          actorCount: 1,
        });
      }

      const hydrated = await hydrateNotificationDoc(notification._id);
      return hydrated;
    } catch (error) {
      const shouldRetry = attempt < 3 && isTransientMongoError(error);
      console.error(`❌ Error creating notification (attempt ${attempt}/3):`, error);

      if (!shouldRetry) {
        throw error;
      }

      await sleep(200 * attempt);
    }
  }
};

export const sendNotificationToUser = async (userId, notificationData) => {
  try {
    const normalizedPayload = normalizeNotificationPayload(userId, notificationData);

    if (normalizedPayload.receiver.equals(normalizedPayload.actor)) {
      console.warn("⚠ Skipping self-notification", {
        userId: String(normalizedPayload.receiver),
        type: normalizedPayload.type,
      });
      return {
        success: true,
        skipped: true,
        reason: "self-notification",
      };
    }

    const notification = await createNotification({
      ...notificationData,
      receiver: normalizedPayload.receiver,
      actor: normalizedPayload.actor,
    });

    if (isSocialNotificationType(normalizedPayload.type)) {
      await emitNotificationCreated(normalizedPayload.receiver, notification);
    }

    const pushPayload = {
      title:
        notificationData?.title ||
        notificationData?.message ||
        "New notification",
      body: notificationData?.message || "",
      link: notificationData?.actionUrl || notificationData?.link || "/",
      data: {
        notificationId: String(notification._id),
        receiverId: String(normalizedPayload.receiver),
        type: normalizedPayload.type,
        relatedPost: normalizedPayload.relatedPost?.toString?.() || "",
        relatedStory: normalizedPayload.relatedStory?.toString?.() || "",
        ...(normalizedPayload.metadata || {}),
      },
    };

    let pushResult = {
      success: false,
      reason: "Push not attempted",
    };

    try {
      pushResult = await sendPushToUser(normalizedPayload.receiver, pushPayload);
    } catch (error) {
      console.error("Push notification failed:", error);
    }

    return {
      success: true,
      notification,
      pushSent: pushResult.success,
      pushResult,
    };
  } catch (error) {
    console.error("❌ Error sending notification to user:", {
      userId,
      type: notificationData?.type,
      error: error?.stack || error,
    });
    throw error;
  }
};

export const registerDeviceToken = async (
  userId,
  token,
  userAgent = "",
  platform = "web",
) => {
  try {
    const user = await User.findById(userId).select("fcmTokens");
    if (!user) {
      throw new Error("User not found");
    }

    // A browser's FCM token belongs to one account at a time. Deactivate
    // stale copies on other accounts before registering it for this user.
    await User.updateMany(
      { _id: { $ne: userId }, "fcmTokens.token": token },
      { $set: { "fcmTokens.$[device].isActive": false } },
      { arrayFilters: [{ "device.token": token }] },
    );

    const deviceFingerprint = crypto
      .createHash("sha256")
      .update(`${userId}-${userAgent}-${platform}`)
      .digest("hex")
      .substring(0, 16);

    const existingTokenIndex = user.fcmTokens.findIndex(
      (t) => t.token === token || t.deviceId === deviceFingerprint,
    );

    if (existingTokenIndex !== -1) {
      user.fcmTokens[existingTokenIndex] = {
        token,
        platform,
        deviceId: deviceFingerprint,
        userAgent,
        lastUsed: new Date(),
        isActive: true,
        registeredAt: user.fcmTokens[existingTokenIndex].registeredAt,
      };
    } else {
      user.fcmTokens.push({
        token,
        platform,
        deviceId: deviceFingerprint,
        userAgent,
        lastUsed: new Date(),
        isActive: true,
        registeredAt: new Date(),
      });
    }

    await user.save();

    return {
      success: true,
      message: "Token registered successfully",
      deviceId: deviceFingerprint,
      activeTokens: user.fcmTokens.filter((t) => t.isActive).length,
    };
  } catch (error) {
    console.error("❌ Error registering device token:", error);
    throw error;
  }
};

export const unregisterDeviceToken = async (userId, deviceId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const tokenIndex = user.fcmTokens.findIndex((t) => t.deviceId === deviceId);

    if (tokenIndex !== -1) {
      user.fcmTokens[tokenIndex].isActive = false;
      await user.save();

      return {
        success: true,
        message: "Token deactivated successfully",
      };
    }

    return {
      success: false,
      message: "Token not found",
    };
  } catch (error) {
    console.error("❌ Error deactivating token:", error);
    throw error;
  }
};

export const getActiveDevices = async (userId) => {
  try {
    const user = await User.findById(userId).select("fcmTokens");
    if (!user) {
      throw new Error("User not found");
    }

    const activeDevices = user.fcmTokens
      .filter((t) => t.isActive)
      .map((t) => ({
        deviceId: t.deviceId,
        platform: t.platform,
        userAgent: t.userAgent,
        lastUsed: t.lastUsed,
        registeredAt: t.registeredAt,
      }));

    return {
      success: true,
      devices: activeDevices,
      totalActive: activeDevices.length,
    };
  } catch (error) {
    console.error("❌ Error getting active devices:", error);
    throw error;
  }
};

export const markNotificationAsRead = async (notificationId, userId) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        receiver: userId,
        type: { $in: SOCIAL_NOTIFICATION_TYPES },
        isRead: false,
      },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true },
    )
      .populate("actor", "username fullName avatar")
      .populate("actors", "username fullName avatar")
      .populate("relatedPost", "postImage")
      .populate("relatedStory", "media")
      .lean();

    if (notification) {
      return notification;
    }

    const existing = await Notification.findOne({
      _id: notificationId,
      receiver: userId,
      type: { $in: SOCIAL_NOTIFICATION_TYPES },
    })
      .populate("actor", "username fullName avatar")
      .populate("actors", "username fullName avatar")
      .populate("relatedPost", "postImage")
      .populate("relatedStory", "media")
      .lean();

    if (!existing) {
      throw new Error("Notification not found");
    }

    return existing;
  } catch (error) {
    console.error("❌ Error marking notification as read:", error);
    throw error;
  }
};

export const markAllNotificationsAsRead = async (userId) => {
  try {
    const result = await Notification.markAllAsRead(userId);
    return {
      success: true,
      modifiedCount: result.modifiedCount,
    };
  } catch (error) {
    console.error("❌ Error marking all notifications as read:", error);
    throw error;
  }
};

export const deleteNotification = async (notificationId, userId) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      receiver: userId,
      type: { $in: SOCIAL_NOTIFICATION_TYPES },
    });

    if (!notification) {
      throw new Error("Notification not found");
    }

    return { success: true };
  } catch (error) {
    console.error("❌ Error deleting notification:", error);
    throw error;
  }
};

export const getUserNotifications = async (userId, page = 1, limit = 20) => {
  try {
    const normalizedPage = Math.max(1, Number(page));
    const normalizedLimit = Math.min(50, Math.max(1, Number(limit)));
    const skip = (normalizedPage - 1) * normalizedLimit;
    const filter = {
      receiver: userId,
      type: { $in: SOCIAL_NOTIFICATION_TYPES },
    };

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ isRead: 1, updatedAt: -1, _id: -1 })
        .skip(skip)
        .limit(normalizedLimit)
        .populate("actor", "username fullName avatar")
        .populate("actors", "username fullName avatar")
        .populate("relatedPost", "postImage")
        .populate("relatedStory", "media")
        .lean(),
      Notification.countDocuments(filter),
      Notification.getUnreadCount(userId),
    ]);

    const formattedNotifications = notifications.map(formatNotification);
    const totalPages = total > 0 ? Math.ceil(total / normalizedLimit) : 0;

    return {
      success: true,
      notifications: formattedNotifications,
      unreadCount,
      currentPage: normalizedPage,
      totalPages,
      totalItems: total,
      hasMore: skip + formattedNotifications.length < total,
    };
  } catch (error) {
    console.error("❌ Error getting user notifications:", error);
    throw error;
  }
};
