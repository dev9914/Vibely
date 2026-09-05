import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { Post } from "../models/post.model.js";
import { deleteCache, getCache, setCache } from "../utils/cache.js";
import { enqueueNotificationJob } from "../../queues/notification.queue.js";

const createPost = asyncHandler(async (req, res) => {
  const { description } = req.body;

  const localPostImages = req.files?.postImage?.map((image) => image.path);

  if (!localPostImages?.length) {
    return res
      .status(400)
      .json(new ApiResponse(400, {}, "At least one image is required"));
  }

  console.log(localPostImages);

  const cloudinaryImages = await uploadOnCloudinary(localPostImages);
  console.log(cloudinaryImages);
  if (!cloudinaryImages) {
    return res
      .status(501)
      .json(new ApiResponse(501, {}, "Some problem occured while uploading"));
  }
  const imageUrls = cloudinaryImages.map((image) => image.url);

  const post = await Post.create({
    userId: req.user._id,
    description,
    postImage: imageUrls,
  });

  if (!post) {
    return res
      .status(500)
      .json(new ApiResponse(500, {}, "Error creating post"));
  }

  res
    .status(201)
    .json(new ApiResponse(201, { post }, "images uploaded successfully"));
});

const addLike = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user._id;

  const post = await Post.findById(postId);

  if (!post) {
    return res.status(404).json(new ApiResponse(404, {}, "Post not found"));
  }

  if (post.likes.includes(userId)) {
    post.likes = post.likes.filter((id) => id.toString() !== userId.toString());
    post.likecount = post.likes.length;
    const updatedPost = await post.save();
    await deleteCache(`post:${postId}`);
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { post: updatedPost },
          "Like removed successfully",
        ),
      );
  } else {
    post.likes.push(userId);
    post.likecount = post.likes.length;
    const updatedPost = await post.save();
    await deleteCache(`post:${postId}`);

    // Send notification to post owner (if not self-like)
    if (post.userId.toString() !== userId.toString()) {
      try {
        await enqueueNotificationJob(post.userId, {
          sender: userId,
          type: "like",
          title: `${req.user.username} liked your post`,
          message: post.description?.substring(0, 50) || "Your post",
          actionUrl: `/post/${postId}`,
          relatedResource: {
            resourceType: "post",
            resourceId: postId,
          },
        });
      } catch (error) {
        console.error("Error sending like notification:", error);
      }
    }

    return res
      .status(201)
      .json(
        new ApiResponse(201, { post: updatedPost }, "Like added successfully"),
      );
  }

  // // post.likecount = post.likes.length
  // // const updatedpost = await post.save()
  // res.status(201).json(new ApiResponse(201,{post: updatedpost},"somthing wen wrong"))
});

const addComment = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { text } = req.body;

  if (!text?.trim()) {
    return res
      .status(400)
      .json(new ApiResponse(400, {}, "Comment text is required"));
  }

  const post = await Post.findById(postId);

  if (!post) {
    return res.status(404).json(new ApiResponse(404, {}, "Post not found"));
  }

  const newComment = {
    userId: req.user._id,
    username: req.user.username,
    avatar: req.user.avatar,
    text,
    createdAt: new Date(),
  };

  post.comments.push(newComment);
  post.commentcount = post.comments.length;
  const updatedpost = await post.save();
  await deleteCache(`post:${postId}`);

  // Send notification to post owner (if not self-comment)
  if (post.userId.toString() !== req.user._id.toString()) {
    try {
      await enqueueNotificationJob(post.userId, {
        sender: req.user._id,
        type: "comment",
        title: `${req.user.username} commented on your post`,
        message: text.substring(0, 50),
        actionUrl: `/post/${postId}`,
        relatedResource: {
          resourceType: "post",
          resourceId: postId,
        },
      });
    } catch (error) {
      console.error("Error sending comment notification:", error);
    }
  }

  return res
    .status(201)
    .json(new ApiResponse(201, { updatedpost }, "comment added successfully"));
});

const POSTS_FIRST_PAGE_MIN = 15;

const _hydrateFeedPosts = async (posts, currentUserId, feedType) => {
  if (!posts.length) return [];
  const hydrated = await Post.aggregate([
    { $match: { _id: { $in: posts.map((p) => p._id) } } },
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
    {
      $lookup: {
        from: "savedposts",
        let: { postId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$userId", currentUserId] },
                  { $eq: ["$postId", "$$postId"] },
                ],
              },
            },
          },
          { $limit: 1 },
          { $project: { _id: 1 } },
        ],
        as: "_savedByMe",
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
        isSaved: { $gt: [{ $size: { $ifNull: ["$_savedByMe", []] } }, 0] },
        feedType,
      },
    },
    { $project: { _author: 0, _savedByMe: 0 } },
  ]);
  const byId = new Map(hydrated.map((p) => [String(p._id), p]));
  return posts.map((p) => byId.get(String(p._id))).filter(Boolean);
};

const getPost = asyncHandler(async (req, res) => {
  const parsedPage = Number.parseInt(req.query.page, 10);
  const parsedLimit = Number.parseInt(req.query.limit, 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? Math.min(parsedLimit, 20)
    : 10;

  const currentUserId = req.user._id;
  const following = Array.isArray(req.user.following) ? req.user.following : [];
  const followingWithSelf = [...following, currentUserId];

  try {
    const followingMatch = { userId: { $in: followingWithSelf } };
    const discoverMatch = { userId: { $nin: followingWithSelf } };

    const [followingTotal, discoverTotal] = await Promise.all([
      Post.countDocuments(followingMatch),
      Post.countDocuments(discoverMatch),
    ]);
    const mergedTotal = followingTotal + discoverTotal;

    const effectiveFirstSize = Math.max(limit, POSTS_FIRST_PAGE_MIN);

    let effectiveLimit;
    let globalSkip;
    if (page === 1) {
      effectiveLimit = effectiveFirstSize;
      globalSkip = 0;
    } else {
      effectiveLimit = limit;
      globalSkip = effectiveFirstSize + (page - 2) * limit;
    }

    const followingWindowStart = Math.min(globalSkip, followingTotal);
    const followingWindowEnd = Math.min(globalSkip + effectiveLimit, followingTotal);
    const followingSkip = followingWindowStart;
    const followingTake = Math.max(0, followingWindowEnd - followingWindowStart);
    const discoverTake = Math.max(0, effectiveLimit - followingTake);
    const discoverSkip = followingTotal >= globalSkip ? 0 : globalSkip - followingTotal;

    let followingIds = [];
    let discoverIds = [];

    if (followingTake > 0) {
      const rows = await Post.find(followingMatch, { _id: 1 })
        .sort({ createdAt: -1, _id: -1 })
        .skip(followingSkip)
        .limit(followingTake)
        .lean();
      followingIds = rows;
    }
    if (discoverTake > 0) {
      const rows = await Post.find(discoverMatch, { _id: 1 })
        .sort({ createdAt: -1, _id: -1 })
        .skip(discoverSkip)
        .limit(discoverTake)
        .lean();
      discoverIds = rows;
    }

    const [hydratedFollowing, hydratedDiscover] = await Promise.all([
      _hydrateFeedPosts(followingIds, currentUserId, "following"),
      _hydrateFeedPosts(discoverIds, currentUserId, "discover"),
    ]);

    const posts = [...hydratedFollowing, ...hydratedDiscover];

    const effectiveTotalPages = mergedTotal > 0
      ? 1 + Math.max(0, Math.ceil((mergedTotal - effectiveFirstSize) / limit))
      : 0;
    const hasMore = (globalSkip + posts.length) < mergedTotal;

    const payload = {
      posts,
      currentPage: page,
      totalPages: effectiveTotalPages,
      hasMore,
    };

    return res
      .status(200)
      .json(new ApiResponse(200, payload, "All posts fetched successfully"));
  } catch (error) {
    console.error(error);
    res.status(500).json(new ApiResponse(500, {}, "Error fetching posts"));
  }
});

const getLatestFeedHead = asyncHandler(async (req, res) => {
  const currentUserId = req.user._id;
  const following = Array.isArray(req.user.following) ? req.user.following : [];
  const followingWithSelf = [...following, currentUserId];

  const followingMatch = { userId: { $in: followingWithSelf } };
  const discoverMatch = { userId: { $nin: followingWithSelf } };

  const [
    followingCount,
    discoverCount,
    followingHeadRaw,
    discoverHeadRaw,
  ] = await Promise.all([
    Post.countDocuments(followingMatch),
    Post.countDocuments(discoverMatch),
    Post.findOne(followingMatch, { _id: 1, createdAt: 1 })
      .sort({ createdAt: -1, _id: -1 })
      .lean(),
    Post.findOne(discoverMatch, { _id: 1, createdAt: 1 })
      .sort({ createdAt: -1, _id: -1 })
      .lean(),
  ]);

  const followingHead = followingHeadRaw
    ? {
        _id: String(followingHeadRaw._id),
        createdAt: followingHeadRaw.createdAt,
      }
    : null;
  const discoverHead = discoverHeadRaw
    ? {
        _id: String(discoverHeadRaw._id),
        createdAt: discoverHeadRaw.createdAt,
      }
    : null;

  const effectiveHead = followingHead ?? discoverHead ?? null;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        followingHead,
        discoverHead,
        effectiveHead,
        effectiveHeadId: effectiveHead?._id ?? null,
        effectiveHeadCreatedAt: effectiveHead?.createdAt?.toISOString
          ? effectiveHead.createdAt.toISOString()
          : effectiveHead?.createdAt ?? null,
        totalFollowingPosts: followingCount,
        totalDiscoverPosts: discoverCount,
      },
      "Latest feed head fetched successfully",
    ),
  );
});

const checkIfLiked = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user._id;

  const post = await Post.findById(postId);

  if (!post) {
    return res.status(404).json(new ApiResponse(404, {}, "Post not found"));
  }

  // Check if the user has already liked the post
  const userHasLiked = post.likes.includes(userId);

  if (userHasLiked) {
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { liked: true },
          "User has already liked this post",
        ),
      );
  } else {
    return res
      .status(200)
      .json(
        new ApiResponse(200, { liked: false }, "User has not liked this post"),
      );
  }
});

const getuserPostById = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    return res
      .status(400)
      .json(new ApiResponse(400, {}, "User id is required"));
  }

  const parsedPage = Number.parseInt(req.query.page, 10);
  const parsedLimit = Number.parseInt(req.query.limit, 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? parsedLimit
    : 10;
  const skip = (page - 1) * limit;
  const cacheKey = `userPosts:${userId}:${page}:${limit}`;

  // 1. Check cache first
  const cachedUserPosts = await getCache(cacheKey);
  if (cachedUserPosts) {
    return res
      .status(200)
      .json(new ApiResponse(200, cachedUserPosts, "Posts fetched successfully"));
  }

  const totalPosts = await Post.countDocuments({ userId });
  const posts = await Post.find({ userId })
    .sort({ createdAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit);

  const totalPages = Math.ceil(totalPosts / limit);
  const hasMore = page < totalPages;

  if (!posts.length) {
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          {
            posts: [],
            currentPage: page,
            totalPages: 0,
            hasMore: false,
          },
          "No posts yet",
        ),
      );
  }

  const payload = {
    posts,
    currentPage: page,
    totalPages,
    hasMore,
  };

  // 2. Store in cache for 10 minutes
  await setCache(cacheKey, payload, 600);

  return res
    .status(200)
    .json(new ApiResponse(200, payload, "Posts fetched successfully"));
});

const getpostById = asyncHandler(async (req, res) => {
  const { postId } = req.params;

  if (!postId) {
    return res
      .status(400)
      .json(new ApiResponse(400, {}, "Post Id is required"));
  }

  const cacheKey = `post:${postId}`;

  // 1. Check cache first
  const cachedPost = await getCache(cacheKey);
  if (cachedPost) {
    return res
      .status(200)
      .json(new ApiResponse(200, { post: cachedPost }, "Post info fetched successfully!"));
  }

  const post = await Post.findById(postId);

  if (!post) {
    return res
      .status(404)
      .json(new ApiResponse(404, {}, "Post not found"));
  }

  // 2. Store in cache for 10 minutes
  await setCache(cacheKey, post, 600);

  return res
    .status(200)
    .json(new ApiResponse(200, { post }, "Post info fetched successfully!"));
});

export {
  createPost,
  addLike,
  addComment,
  getPost,
  getLatestFeedHead,
  checkIfLiked,
  getuserPostById,
  getpostById,
};
