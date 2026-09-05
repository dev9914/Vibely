import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

export const authCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  path: "/",
};

const buildDefaultAvatar = (fullName) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=1a1a1a&color=ffffff&size=300`;

const prepareAvatarUrl = async (fullName, avatarLocalPath) => {
  if (!avatarLocalPath) {
    return buildDefaultAvatar(fullName);
  }

  const croppedAvatarPath = path.join(
    process.cwd(),
    "uploads",
    `cropped_${Date.now()}.jpg`,
  );

  await sharp(avatarLocalPath).resize(300, 300).toFile(croppedAvatarPath);

  try {
    const uploadedAvatar = await uploadOnCloudinary([croppedAvatarPath]);
    const avatarUrl = uploadedAvatar?.[0]?.secure_url || uploadedAvatar?.[0]?.url;

    return avatarUrl || buildDefaultAvatar(fullName);
  } finally {
    await fs.unlink(croppedAvatarPath).catch(() => {});
  }
};

const getSanitizedUser = async (userId) => {
  const user = await User.findById(userId).select("-password -refreshToken");

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return user;
};

export const generateTokens = async (userId) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  return { accessToken, refreshToken };
};

export const registerUserService = async ({
  fullName,
  email,
  username,
  password,
  avatarLocalPath,
}) => {
  const normalizedUsername = username?.trim().toLowerCase();
  const normalizedEmail = email?.trim().toLowerCase();

  if ([fullName, email, username, password].some((field) => !field?.trim())) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username: normalizedUsername }, { email: normalizedEmail }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists");
  }

  const avatarUrl = await prepareAvatarUrl(fullName, avatarLocalPath);

  const user = await User.create({
    fullName: fullName.trim(),
    avatar: avatarUrl,
    coverImage: "",
    email: normalizedEmail,
    password,
    username: normalizedUsername,
  });

  const { accessToken, refreshToken } = await generateTokens(user._id);
  const createdUser = await getSanitizedUser(user._id);

  return {
    user: createdUser,
    accessToken,
    refreshToken,
  };
};

export const loginUserService = async ({ username, email, password }) => {
  const normalizedUsername = username?.trim().toLowerCase();
  const normalizedEmail = email?.trim().toLowerCase();

  if (!(username || email)) {
    throw new ApiError(400, "Username or email is required");
  }

  if (!password) {
    throw new ApiError(400, "Password is required");
  }

  const user = await User.findOne({
    $or: [
      { username: normalizedUsername },
      { email: normalizedEmail },
    ],
  });

  if (!user) {
    throw new ApiError(401, "Invalid credentials");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid credentials");
  }

  const { accessToken, refreshToken } = await generateTokens(user._id);
  const loggedInUser = await getSanitizedUser(user._id);

  return {
    user: loggedInUser,
    accessToken,
    refreshToken,
  };
};

export const logoutUserService = async (userId) => {
  await User.findByIdAndUpdate(
    userId,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    { new: true },
  );
};

export const refreshAccessTokenService = async (incomingRefreshToken) => {
  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET,
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid refresh token - User not found");
    }

    if (incomingRefreshToken !== user.refreshToken) {
      throw new ApiError(401, "Refresh token has been revoked or reused");
    }

    const { accessToken, refreshToken } = await generateTokens(user._id);
    const sanitizedUser = await getSanitizedUser(user._id);

    return {
      user: sanitizedUser,
      accessToken,
      refreshToken,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error?.name === "TokenExpiredError") {
      throw new ApiError(401, "Refresh token expired");
    }

    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
};