import mongoose from "mongoose";
import { Post } from "../models/post.model.js";
import { User } from "../models/user.models.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const DEFAULT_POST_LIMIT = 18;
const DEFAULT_USER_LIMIT = 18;
const DEFAULT_HASHTAG_LIMIT = 12;
const MAX_LIMIT = 30;
const TRENDING_WINDOW_HOURS = 72;

const parseLimit = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, MAX_LIMIT);
};

const encodeCursor = (payload) =>
  Buffer.from(JSON.stringify(payload)).toString("base64");

const decodeCursor = (cursor) => {
  if (!cursor) return { offset: 0 };

  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
    return {
      offset:
        Number.isFinite(parsed?.offset) && parsed.offset > 0
          ? parsed.offset
          : 0,
    };
  } catch {
    return { offset: 0 };
  }
};

const toUniqueObjectIds = (values) => {
  const seen = new Set();
  const ids = [];

  for (const value of values) {
    if (!value) continue;
    const stringValue = value.toString();
    if (seen.has(stringValue) || !mongoose.Types.ObjectId.isValid(stringValue)) {
      continue;
    }
    seen.add(stringValue);
    ids.push(new mongoose.Types.ObjectId(stringValue));
  }

  return ids;
};

const getExcludedUserIds = (user) =>
  toUniqueObjectIds([
    user?._id,
    ...(Array.isArray(user?.blockedUsers) ? user.blockedUsers : []),
    ...(Array.isArray(user?.mutedUsers) ? user.mutedUsers : []),
  ]);

const getDiscoverUserExclusions = (user) =>
  toUniqueObjectIds([
    ...getExcludedUserIds(user),
    ...(Array.isArray(user?.following) ? user.following : []),
  ]);

const escapeRegex = (value = "") =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildPostHydrationStages = (currentUserId) => [
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
      localField: "_id",
      foreignField: "postId",
      as: "_savedRefs",
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
                { $eq: ["$postId", "$$postId"] },
                { $eq: ["$userId", currentUserId] },
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
  {
    $unwind: {
      path: "$_author",
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $addFields: {
      likesCount: { $size: { $ifNull: ["$likes", []] } },
      commentsCount: { $size: { $ifNull: ["$comments", []] } },
      savedCount: { $size: { $ifNull: ["$_savedRefs", []] } },
      previewImage: { $arrayElemAt: ["$postImage", 0] },
      author: {
        _id: "$_author._id",
        username: "$_author.username",
        fullName: "$_author.fullName",
        avatar: "$_author.avatar",
      },
      ageHours: {
        $divide: [
          { $subtract: [new Date(), "$createdAt"] },
          1000 * 60 * 60,
        ],
      },
    },
  },
  {
    $addFields: {
      recencyBoost: {
        $max: [0, { $subtract: [TRENDING_WINDOW_HOURS, "$ageHours"] }],
      },
      trendingScore: {
        $add: [
          { $multiply: ["$likesCount", 3] },
          { $multiply: ["$commentsCount", 5] },
          { $multiply: ["$savedCount", 4] },
          {
            $max: [0, { $subtract: [TRENDING_WINDOW_HOURS, "$ageHours"] }],
          },
        ],
      },
      isSaved: {
        $gt: [{ $size: { $ifNull: ["$_savedByMe", []] } }, 0],
      },
    },
  },
  {
    $project: {
      _author: 0,
      _savedRefs: 0,
      _savedByMe: 0,
      ageHours: 0,
    },
  },
];

const fetchPostsWithPipeline = async ({
  match,
  sort,
  skip = 0,
  limit,
  currentUserId,
}) =>
  Post.aggregate([
    { $match: match },
    ...buildPostHydrationStages(currentUserId),
    { $sort: sort },
    { $skip: skip },
    { $limit: limit },
  ]);

const getTrendingHashtags = async ({ excludedUserIds, query = "", limit, offset }) => {
  const escaped = query ? escapeRegex(query.toLowerCase()) : "";
  const hashtagRegex = /#[a-z0-9_]+/g;

  const pipeline = [
    {
      $match: {
        userId: { $nin: excludedUserIds },
        description: { $regex: /#/ },
      },
    },
    {
      $lookup: {
        from: "savedposts",
        localField: "_id",
        foreignField: "postId",
        as: "_savedRefs",
      },
    },
    {
      $project: {
        createdAt: 1,
        previewImage: { $arrayElemAt: ["$postImage", 0] },
        postScore: {
          $add: [
            { $multiply: [{ $size: { $ifNull: ["$likes", []] } }, 3] },
            { $multiply: [{ $size: { $ifNull: ["$comments", []] } }, 5] },
            { $multiply: [{ $size: { $ifNull: ["$_savedRefs", []] } }, 4] },
          ],
        },
        tags: {
          $regexFindAll: {
            input: { $toLower: { $ifNull: ["$description", ""] } },
            regex: hashtagRegex,
          },
        },
      },
    },
    { $unwind: "$tags" },
    {
      $project: {
        createdAt: 1,
        previewImage: 1,
        postScore: 1,
        tag: {
          $replaceOne: {
            input: "$tags.match",
            find: "#",
            replacement: "",
          },
        },
      },
    },
  ];

  if (escaped) {
    pipeline.push({
      $match: {
        tag: { $regex: escaped, $options: "i" },
      },
    });
  }

  pipeline.push(
    {
      $group: {
        _id: "$tag",
        postCount: { $sum: 1 },
        totalScore: { $sum: "$postScore" },
        latestPostAt: { $max: "$createdAt" },
        previewImages: { $push: "$previewImage" },
      },
    },
    {
      $addFields: {
        previewImages: {
          $slice: [
            {
              $filter: {
                input: "$previewImages",
                as: "image",
                cond: { $ne: ["$$image", null] },
              },
            },
            3,
          ],
        },
        recencyBoost: {
          $max: [
            0,
            {
              $subtract: [
                TRENDING_WINDOW_HOURS,
                {
                  $divide: [
                    { $subtract: [new Date(), "$latestPostAt"] },
                    1000 * 60 * 60,
                  ],
                },
              ],
            },
          ],
        },
      },
    },
    {
      $addFields: {
        trendingScore: { $add: ["$totalScore", "$recencyBoost"] },
      },
    },
    {
      $sort: escaped
        ? { postCount: -1, latestPostAt: -1, _id: 1 }
        : { trendingScore: -1, postCount: -1, latestPostAt: -1, _id: 1 },
    },
    { $skip: offset },
    { $limit: limit + 1 },
  );

  const rows = await Post.aggregate(pipeline);
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map((row) => ({
    tag: row._id,
    postCount: row.postCount,
    trendingScore: row.trendingScore,
    previewImages: row.previewImages || [],
    latestPostAt: row.latestPostAt,
  }));

  return {
    hashtags: items,
    hasMore,
    nextCursor: hasMore ? encodeCursor({ offset: offset + items.length }) : null,
  };
};

const formatUser = (user) => ({
  _id: user._id,
  username: user.username,
  fullName: user.fullName,
  avatar: user.avatar,
  followersCount: user.followersCount ?? 0,
  followingCount: user.followingCount ?? 0,
});

const getPeopleExploreRows = async ({
  excludedUserIds,
  offset,
  limit,
}) => {
  const rows = await User.aggregate([
    {
      $match: {
        _id: { $nin: excludedUserIds },
      },
    },
    {
      $addFields: {
        followersCount: { $size: { $ifNull: ["$followers", []] } },
        followingCount: { $size: { $ifNull: ["$following", []] } },
      },
    },
    {
      $project: {
        username: 1,
        fullName: 1,
        avatar: 1,
        followersCount: 1,
        followingCount: 1,
        createdAt: 1,
      },
    },
    { $sort: { followersCount: -1, createdAt: -1, _id: -1 } },
    { $skip: offset },
    { $limit: limit + 1 },
  ]);

  const hasMore = rows.length > limit;
  const users = rows.slice(0, limit).map(formatUser);

  return {
    users,
    hasMore,
    nextCursor: hasMore ? encodeCursor({ offset: offset + users.length }) : null,
  };
};

export const getExplore = asyncHandler(async (req, res) => {
  const tab = ["trending", "recent", "people"].includes(req.query.tab)
    ? req.query.tab
    : "trending";
  const limit = parseLimit(
    req.query.limit,
    tab === "people" ? DEFAULT_USER_LIMIT : DEFAULT_POST_LIMIT,
  );
  const { offset } = decodeCursor(req.query.cursor);
  const excludedUserIds = getExcludedUserIds(req.user);
  const discoverUserExclusions = getDiscoverUserExclusions(req.user);
  const currentUserId = new mongoose.Types.ObjectId(req.user._id.toString());

  if (tab === "people") {
    const [people, hashtags] = await Promise.all([
      getPeopleExploreRows({
        excludedUserIds: discoverUserExclusions,
        offset,
        limit,
      }),
      getTrendingHashtags({
        excludedUserIds,
        limit: 8,
        offset: 0,
      }),
    ]);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          mode: tab,
          users: people.users,
          nextCursor: people.nextCursor,
          hasMore: people.hasMore,
          trendingHashtags: hashtags.hashtags,
        },
        "Explore people fetched successfully",
      ),
    );
  }

  if (tab === "recent") {
    const [rows, hashtags] = await Promise.all([
      fetchPostsWithPipeline({
        match: {
          userId: { $nin: excludedUserIds },
        },
        sort: { createdAt: -1, _id: -1 },
        skip: offset,
        limit: limit + 1,
        currentUserId,
      }),
      getTrendingHashtags({
        excludedUserIds,
        limit: 8,
        offset: 0,
      }),
    ]);

    const hasMore = rows.length > limit;
    const posts = rows.slice(0, limit);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          mode: tab,
          posts,
          nextCursor: hasMore ? encodeCursor({ offset: offset + posts.length }) : null,
          hasMore,
          trendingHashtags: hashtags.hashtags,
        },
        "Explore recent posts fetched successfully",
      ),
    );
  }

  const poolSize = Math.max(limit * 4, offset + limit * 3);
  const [popularPool, recentPool, discoverPool, hashtags] = await Promise.all([
    fetchPostsWithPipeline({
      match: {
        userId: { $nin: excludedUserIds },
      },
      sort: { trendingScore: -1, createdAt: -1, _id: -1 },
      limit: poolSize,
      currentUserId,
    }),
    fetchPostsWithPipeline({
      match: {
        userId: { $nin: excludedUserIds },
      },
      sort: { createdAt: -1, _id: -1 },
      limit: poolSize,
      currentUserId,
    }),
    fetchPostsWithPipeline({
      match: {
        userId: { $nin: discoverUserExclusions },
      },
      sort: { createdAt: -1, _id: -1 },
      limit: poolSize,
      currentUserId,
    }),
    getTrendingHashtags({
      excludedUserIds,
      limit: 8,
      offset: 0,
    }),
  ]);

  const merged = [];
  const seen = new Set();
  const pools = [popularPool, recentPool, discoverPool];
  const maxLength = Math.max(...pools.map((items) => items.length), 0);

  for (let index = 0; index < maxLength; index += 1) {
    for (const pool of pools) {
      const item = pool[index];
      if (!item) continue;
      const id = item._id.toString();
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push(item);
    }
  }

  const posts = merged.slice(offset, offset + limit);
  const poolsMayHaveMore = [popularPool, recentPool, discoverPool].some(
    (pool) => pool.length >= poolSize,
  );
  const hasMore = merged.length > offset + posts.length || poolsMayHaveMore;

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        mode: tab,
        posts,
        nextCursor: hasMore ? encodeCursor({ offset: offset + posts.length }) : null,
        hasMore,
        trendingHashtags: hashtags.hashtags,
      },
      "Explore trending posts fetched successfully",
    ),
  );
});

export const searchUsers = asyncHandler(async (req, res) => {
  const query = (req.query.q || "").trim();
  const limit = parseLimit(req.query.limit, DEFAULT_USER_LIMIT);
  const { offset } = decodeCursor(req.query.cursor);
  const excludedUserIds = getExcludedUserIds(req.user);

  if (!query) {
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          users: [],
          nextCursor: null,
          hasMore: false,
        },
        "Search users fetched successfully",
      ),
    );
  }

  const regex = new RegExp(escapeRegex(query), "i");
  const rows = await User.aggregate([
    {
      $match: {
        _id: { $nin: excludedUserIds },
        $or: [
          { username: { $regex: regex } },
          { fullName: { $regex: regex } },
        ],
      },
    },
    {
      $addFields: {
        followersCount: { $size: { $ifNull: ["$followers", []] } },
        followingCount: { $size: { $ifNull: ["$following", []] } },
        usernameExactMatch: {
          $cond: [{ $eq: [{ $toLower: "$username" }, query.toLowerCase()] }, 1, 0],
        },
      },
    },
    {
      $project: {
        username: 1,
        fullName: 1,
        avatar: 1,
        followersCount: 1,
        followingCount: 1,
        usernameExactMatch: 1,
        createdAt: 1,
      },
    },
    { $sort: { usernameExactMatch: -1, followersCount: -1, createdAt: -1, _id: -1 } },
    { $skip: offset },
    { $limit: limit + 1 },
  ]);

  const hasMore = rows.length > limit;
  const users = rows.slice(0, limit).map(formatUser);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        users,
        nextCursor: hasMore ? encodeCursor({ offset: offset + users.length }) : null,
        hasMore,
      },
      "Search users fetched successfully",
    ),
  );
});

export const searchPosts = asyncHandler(async (req, res) => {
  const query = (req.query.q || "").trim();
  const mode = req.query.mode === "recent" ? "recent" : "trending";
  const limit = parseLimit(req.query.limit, DEFAULT_POST_LIMIT);
  const { offset } = decodeCursor(req.query.cursor);
  const excludedUserIds = getExcludedUserIds(req.user);
  const currentUserId = new mongoose.Types.ObjectId(req.user._id.toString());

  if (!query) {
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          posts: [],
          nextCursor: null,
          hasMore: false,
        },
        "Search posts fetched successfully",
      ),
    );
  }

  const regex = new RegExp(escapeRegex(query), "i");
  const rows = await fetchPostsWithPipeline({
    match: {
      userId: { $nin: excludedUserIds },
      description: { $regex: regex },
    },
    sort:
      mode === "recent"
        ? { createdAt: -1, _id: -1 }
        : { trendingScore: -1, createdAt: -1, _id: -1 },
    skip: offset,
    limit: limit + 1,
    currentUserId,
  });

  const hasMore = rows.length > limit;
  const posts = rows.slice(0, limit);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        posts,
        nextCursor: hasMore ? encodeCursor({ offset: offset + posts.length }) : null,
        hasMore,
      },
      "Search posts fetched successfully",
    ),
  );
});

export const searchHashtags = asyncHandler(async (req, res) => {
  const query = (req.query.q || "").trim().replace(/^#/, "");
  const limit = parseLimit(req.query.limit, DEFAULT_HASHTAG_LIMIT);
  const { offset } = decodeCursor(req.query.cursor);
  const excludedUserIds = getExcludedUserIds(req.user);

  const result = await getTrendingHashtags({
    excludedUserIds,
    query,
    limit,
    offset,
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        hashtags: result.hashtags,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      },
      "Search hashtags fetched successfully",
    ),
  );
});
