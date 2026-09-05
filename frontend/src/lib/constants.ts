/**
 * Application Constants
 * Centralized configuration for the entire app
 */

import { getApiBaseUrl } from './apiConfig'

// ========== API CONFIGURATION ==========
export const API_URL = getApiBaseUrl()

// ========== PAGINATION ==========
export const POSTS_PER_PAGE = 10
export const MESSAGES_PER_PAGE = 30
export const USERS_PER_PAGE = 20

// ========== FILE UPLOAD LIMITS ==========
export const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
export const MAX_IMAGES_PER_POST = 5
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']

// ========== TEXT LIMITS ==========
export const MAX_POST_DESCRIPTION_LENGTH = 2200
export const MAX_COMMENT_LENGTH = 500
export const MAX_MESSAGE_LENGTH = 1000
export const MAX_USERNAME_LENGTH = 20
export const MIN_USERNAME_LENGTH = 3
export const MAX_FULLNAME_LENGTH = 50
export const MIN_PASSWORD_LENGTH = 6

// ========== SOCKET EVENTS ==========
export const SOCKET_EVENTS = {
  MESSAGE_NEW: 'message:new',
  MESSAGE_DELIVERED: 'message:delivered',
  MESSAGE_SEEN: 'message:seen',
  MESSAGE_DELETE: 'message:delete',
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  PRESENCE_UPDATE: 'presence:update',
  PRESENCE_REQUEST_SYNC: 'presence:request-sync',
  CONVERSATION_UPDATE: 'conversation:update',
  NEW_MESSAGE: 'newMessage',
  ONLINE_USERS: 'getOnlineUsers',
  NEW_NOTIFICATION: 'newNotification',
} as const

// ========== NOTIFICATION TYPES ==========
export const NOTIFICATION_TYPES = {
  LIKE: 'like',
  COMMENT: 'comment',
  FOLLOW: 'follow',
  STORY_LIKE: 'story_like',
  MENTION: 'mention',
} as const

// ========== ROUTES ==========
export const ROUTES = {
  HOME: '/',
  EXPLORE: '/explore',
  PROFILE: '/profile',
  USER_PROFILE: '/user/:userId',
  POST: '/post/:postId',
  MESSAGES: '/messages',
  CHAT: '/chat/:receiverId',
  SIGNIN: '/signin',
  SIGNUP: '/signup',
  CREATE_POST: '/create',
} as const

// ========== LOCAL STORAGE KEYS ==========
export const STORAGE_KEYS = {
  THEME: 'theme',
  USER_PREFERENCES: 'userPreferences',
} as const

// ========== QUERY KEYS ==========
export const QUERY_KEYS = {
  POSTS: 'posts',
  POST: 'post',
  USER: 'user',
  USERS: 'users',
  MESSAGES: 'messages',
  NOTIFICATIONS: 'notifications',
} as const

// ========== TIME CONSTANTS ==========
export const TOKEN_EXPIRY_TIME = 12 * 60 * 60 * 1000 // 12 hours
export const NOTIFICATION_POLL_INTERVAL = 30000 // 30 seconds
export const MESSAGE_POLL_INTERVAL = 5000 // 5 seconds

// ========== UI CONSTANTS ==========
export const TOAST_DURATION = 3000
export const MODAL_ANIMATION_DURATION = 200
export const DEBOUNCE_DELAY = 300

// ========== VALIDATION PATTERNS ==========
export const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/
export const EMAIL_PATTERN = /@gmail\.com$/

// ========== ERROR MESSAGES ==========
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'Session expired. Please login again.',
  SERVER_ERROR: 'Something went wrong. Please try again.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  FILE_TOO_LARGE: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`,
  INVALID_FILE_TYPE: 'Only JPEG, JPG, PNG, and WEBP images are allowed.',
} as const

// ========== SUCCESS MESSAGES ==========
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Welcome back!',
  REGISTER_SUCCESS: 'Account created successfully!',
  POST_CREATED: 'Post created successfully!',
  POST_DELETED: 'Post deleted successfully!',
  COMMENT_ADDED: 'Comment added!',
  PROFILE_UPDATED: 'Profile updated successfully!',
  PASSWORD_CHANGED: 'Password changed successfully!',
} as const

// ========== FEATURE FLAGS ==========
export const FEATURES = {
  AI_CAPTIONS: true,
  PUSH_NOTIFICATIONS: true,
  DARK_MODE: true,
  VIDEO_POSTS: false, // Future feature
  STORIES: false, // Future feature
} as const
