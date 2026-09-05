import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { Post } from "../models/post.model.js";
import { SavedPost } from "../models/savedPost.model.js";

const POSTS_FIRST_PAGE_MIN = 15;

const _hydrateSavedPosts = async (rows, currentUserId) => {
  if (!rows.length) return [];
  const postIds = rows.map((r) => r.postId);
  const hydrated = await Post.aggregate([
    { $match: { _id: { $in: postIds } } },
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "_author",
        pipeline: [
          {
            $project: {
              _id: 1,
              username: 1,
              fullName: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    { $unwind: { path: "$_author", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        author: {
          _id: "$_author._id",
          username: "$_author.username",
          fullName: "$_author.fullName",
          avatar: "$_author.avatar",
        },
        isLiked: { $in: [currentUserId, { $ifNull: ["$likes", []] }] },
        isSaved: true,
        feedType: "following",
      },
    },
    { $project: { _author: 0 } },
  ]);
  const byId = new Map(hydrated.map((p) => [String(p._id), p]));
  return rows
    .map((r) => byId.get(String(r.postId)))
    .filter(Boolean);
};

const savePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user._id;

  if (!postId) {
    throw new ApiError(400, "Post id is required");
  }

  const post = await Post.findById(postId, { _id: 1 }).lean();
  if (!post) {
    throw new ApiError(404, "Post not found");
  }

  try {
    await SavedPost.create({ userId, postId });
  } catch (err) {
    if (err && err.code === 11000) {
      return res
        .status(200)
        .json(new ApiResponse(200, { saved: true }, "Post already saved"));
    }
    throw err;
  }

  return res
    .status(201)
    .json(new ApiResponse(201, { saved: true }, "Post saved successfully"));
});

const unsavePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user._id;

  if (!postId) {
    throw new ApiError(400, "Post id is required");
  }

  const result = await SavedPost.deleteOne({ userId, postId });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        saved: false,
        removed: result.deletedCount > 0,
      },
      "Post unsaved successfully",
    ),
  );
});

const getMySavedPosts = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const parsedPage = Number.parseInt(req.query.page, 10);
  const parsedLimit = Number.parseInt(req.query.limit, 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(parsedLimit, 60)
    : 30;
  const skip = (page - 1) * limit;

  const effectiveFirstSize = Math.max(limit, POSTS_FIRST_PAGE_MIN);
  let effectiveLimit;
  let effectiveSkip;
  if (page === 1) {
    effectiveLimit = effectiveFirstSize;
    effectiveSkip = 0;
  } else {
    effectiveLimit = limit;
    effectiveSkip = effectiveFirstSize + (page - 2) * limit;
  }

  const totalSaved = await SavedPost.countDocuments({ userId });
  const savedRows = await SavedPost.find({ userId }, { postId: 1, _id: 0 })
    .sort({ createdAt: -1, _id: -1 })
    .skip(effectiveSkip)
    .limit(effectiveLimit)
    .lean();

  const posts = await _hydrateSavedPosts(savedRows, userId);

  const effectiveTotalPages = totalSaved > 0
    ? 1 + Math.max(0, Math.ceil((totalSaved - effectiveFirstSize) / limit))
    : 0;
  const hasMore = (effectiveSkip + posts.length) < totalSaved;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        posts,
        currentPage: page,
        totalPages: effectiveTotalPages,
        hasMore,
      },
      "Saved posts fetched successfully",
    ),
  );
});

export { savePost, unsavePost, getMySavedPosts };
