import mongoose from "mongoose";
import { Schema } from "mongoose";

export const SOCIAL_NOTIFICATION_TYPES = [
  "like",
  "comment",
  "follow",
  "story_like",
  "mention",
];

const NotificationSchema = new Schema(
  {
    receiver: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Stores grouped actors for like/comment/story-like notifications.
    actors: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    actorCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    type: {
      type: String,
      enum: [...SOCIAL_NOTIFICATION_TYPES, "message"],
      required: true,
      index: true,
    },
    relatedPost: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      default: null,
      index: true,
    },
    relatedStory: {
      type: Schema.Types.ObjectId,
      ref: "Story",
      default: null,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      default: "",
    },
    message: {
      type: String,
      trim: true,
      default: "",
    },
    actionUrl: {
      type: String,
      trim: true,
      default: "",
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

NotificationSchema.index({ receiver: 1, isRead: 1, updatedAt: -1, _id: -1 });
NotificationSchema.index({ receiver: 1, type: 1, relatedPost: 1, relatedStory: 1 });
NotificationSchema.index({ actor: 1, receiver: 1, type: 1 });

NotificationSchema.virtual("sender").get(function senderAlias() {
  return this.actor;
});

NotificationSchema.virtual("recipient").get(function recipientAlias() {
  return this.receiver;
});

NotificationSchema.set("toJSON", { virtuals: true });
NotificationSchema.set("toObject", { virtuals: true });

NotificationSchema.statics.getUnreadCount = async function getUnreadCount(
  userId,
  types = SOCIAL_NOTIFICATION_TYPES,
) {
  return this.countDocuments({
    receiver: userId,
    type: { $in: types },
    isRead: false,
  });
};

NotificationSchema.statics.markAllAsRead = async function markAllAsRead(
  userId,
  types = SOCIAL_NOTIFICATION_TYPES,
) {
  const now = new Date();
  return this.updateMany(
    { receiver: userId, type: { $in: types }, isRead: false },
    { $set: { isRead: true, readAt: now } },
  );
};

export const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", NotificationSchema);
