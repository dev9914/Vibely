import { Schema, mongo } from "mongoose";
import mongoose from "mongoose";

const PostSchema = new Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId, // who is posting 
      ref: "User",
      required: true,
    },
    postImage: {
      type: [String],
      required: true,
    },
    description:{
      type: String,
      maxlenght: 200
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    comments: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        text: { type: String },
        username: {type: String},
        avatar: {type: String},
        createdAt: { type: Date, default: Date.now },
      },
    ],
    likecount: {
      type: String,
      default: 0
    },
    commentcount: {
      type: String,
      default: 0
    },
  },
  { timestamps: true }
);

PostSchema.index({ userId: 1, createdAt: -1, _id: -1 });
PostSchema.index({ createdAt: -1, _id: -1 });
PostSchema.index({ description: "text" });

export const Post = mongoose.model("Post", PostSchema);
