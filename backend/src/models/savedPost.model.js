import mongoose, { Schema } from "mongoose";

const savedPostSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    postId: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

savedPostSchema.index({ userId: 1, postId: 1 }, { unique: true });

export const SavedPost = mongoose.model("SavedPost", savedPostSchema);
