import mongoose, { Schema } from "mongoose";

const storyMediaSchema = new Schema(
  {
    mediaType: {
      type: String,
      enum: ["image", "video"],
      required: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false },
);

const storySchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    media: {
      type: storyMediaSchema,
      required: true,
    },
    viewers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    expiresAt: {
      type: Date,
      required: true,
      index: { type: "ttl", expires: 0 },
    },
  },
  { timestamps: true },
);

storySchema.index({ user: 1, createdAt: -1, _id: -1 });

export const Story = mongoose.model("Story", storySchema);
