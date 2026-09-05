import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { Story } from "../models/story.model.js";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

const _hydrateUser = (storyRows, usersMap) =>
  storyRows.map((s) => {
    const u = usersMap.get(String(s.user));
    return {
      _id: String(s._id),
      user: u
        ? {
            _id: u._id,
            username: u.username,
            fullName: u.fullName,
            avatar: u.avatar,
          }
        : { _id: String(s.user) },
      media: s.media,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      viewCount: Array.isArray(s.viewers) ? s.viewers.length : 0,
      hasViewed: Array.isArray(s.viewers)
        ? s.viewers.some((v) => String(v) === String(s._currentViewerId))
        : false,
    };
  });

const _groupStoriesByUser = (hydratedStories) => {
  const order = [];
  const byUser = new Map();
  for (const s of hydratedStories) {
    const uid = String(s.user._id);
    if (!byUser.has(uid)) {
      byUser.set(uid, {
        user: s.user,
        stories: [],
        hasUnseen: false,
      });
      order.push(uid);
    }
    const bucket = byUser.get(uid);
    bucket.stories.push(s);
    if (!s.hasViewed) bucket.hasUnseen = true;
  }
  return order.map((uid) => byUser.get(uid));
};

const createStory = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const imagePaths = [];
  const videoPaths = [];
  if (req.files) {
    if (Array.isArray(req.files.image)) {
      for (const f of req.files.image) imagePaths.push(f.path);
    } else if (req.files.image && Array.isArray(req.files.image)) {
      imagePaths.push(req.files.image[0].path);
    }
    if (Array.isArray(req.files.video)) {
      for (const f of req.files.video) videoPaths.push(f.path);
    }
  }
  if (req.file && req.file.fieldname === "image") imagePaths.push(req.file.path);
  if (req.file && req.file.fieldname === "video") videoPaths.push(req.file.path);

  if (!imagePaths.length && !videoPaths.length) {
    throw new ApiError(400, "At least one image or video file is required");
  }

  const mediaItems = [];

  if (imagePaths.length) {
    const images = await uploadOnCloudinary(imagePaths);
    if (images) {
      for (const im of images) {
        if (im?.url) {
          mediaItems.push({ mediaType: "image", url: im.url });
        }
      }
    }
  }

  if (videoPaths.length) {
    const videos = await uploadOnCloudinary(videoPaths);
    if (videos) {
      for (const v of videos) {
        if (v?.url) {
          mediaItems.push({ mediaType: "video", url: v.url });
        }
      }
    }
  }

  if (!mediaItems.length) {
    throw new ApiError(500, "Failed to upload story media");
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + TWENTY_FOUR_HOURS_MS);

  const created = await Story.create(
    mediaItems.map((m) => ({
      user: userId,
      media: m,
      viewers: [],
      expiresAt,
    })),
  );

  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        { count: created.length, ids: created.map((s) => s._id) },
        "Story created successfully",
      ),
    );
});

const deleteStory = asyncHandler(async (req, res) => {
  const { storyId } = req.params;
  const userId = req.user._id;

  if (!storyId) {
    throw new ApiError(400, "Story id is required");
  }

  const story = await Story.findOne({
    _id: storyId,
    user: userId,
  }).select({ _id: 1 });
  if (!story) {
    throw new ApiError(404, "Story not found or not owned by you");
  }

  await Story.deleteOne({ _id: storyId, user: userId });

  return res
    .status(200)
    .json(new ApiResponse(200, { deleted: true }, "Story deleted successfully"));
});

const getStoriesFeed = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;
  const following = Array.isArray(req.user.following) ? req.user.following : [];
  const userIds = [...following, currentUserId];

  const now = new Date();
  const rows = await Story.aggregate([
    {
      $match: {
        user: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) },
        expiresAt: { $gt: now },
      },
    },
    { $sort: { user: 1, createdAt: -1, _id: -1 } },
    {
      $addFields: {
        _currentViewerId: currentUserId.toString(),
      },
    },
  ]);

  const uniqueUserIds = Array.from(new Set(rows.map((r) => String(r.user))));
  const users = await mongoose
    .model("User")
    .find(
      { _id: { $in: uniqueUserIds } },
      { _id: 1, username: 1, fullName: 1, avatar: 1 },
    )
    .lean();
  const usersMap = new Map(users.map((u) => [String(u._id), u]));

  const hydrated = _hydrateUser(rows, usersMap);
  const groups = _groupStoriesByUser(hydrated);

  const mineIndex = groups.findIndex((g) => String(g.user._id) === String(currentUserId));
  let mine = null;
  if (mineIndex >= 0) {
    [mine] = groups.splice(mineIndex, 1);
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        groups,
        mine,
        currentUserId: String(currentUserId),
      },
      "Stories feed fetched successfully",
    ),
  );
});

const markStoryViewed = asyncHandler(async (req, res) => {
  const { storyId } = req.params;
  const userId = req.user._id;

  if (!storyId) {
    throw new ApiError(400, "Story id is required");
  }

  const story = await Story.findById(storyId).select({ _id: 1, expiresAt: 1 });
  if (!story) {
    throw new ApiError(404, "Story not found");
  }

  await Story.updateOne(
    { _id: storyId, viewers: { $ne: userId } },
    { $addToSet: { viewers: userId } },
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { viewed: true }, "Story marked as viewed"));
});

const getUserStories = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user._id;

  if (!userId) {
    throw new ApiError(400, "User id is required");
  }

  const now = new Date();
  const rows = await Story.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        expiresAt: { $gt: now },
      },
    },
    { $sort: { createdAt: 1, _id: 1 } },
    {
      $addFields: {
        _currentViewerId: currentUserId.toString(),
      },
    },
  ]);

  const userDoc = await mongoose
    .model("User")
    .findById(userId, { _id: 1, username: 1, fullName: 1, avatar: 1 })
    .lean();
  const usersMap = userDoc ? new Map([[String(userId), userDoc]]) : new Map();
  const hydrated = _hydrateUser(rows, usersMap);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        user: userDoc,
        stories: hydrated,
        hasUnseen: hydrated.some((s) => !s.hasViewed),
      },
      "User stories fetched successfully",
    ),
  );
});

export {
  createStory,
  deleteStory,
  getStoriesFeed,
  markStoryViewed,
  getUserStories,
};
