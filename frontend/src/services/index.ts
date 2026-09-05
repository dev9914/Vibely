/**
 * Central export file for all API services
 * 
 * Import APIs like:
 * import { postApi, useGetAllPostsQuery } from '@/services';
 */

// Base API
export { default as api } from './api';

// API Services
export { default as notificationApi } from './notificationApi';
export { default as postApi } from './postApi';
export { default as userApi } from './userApi';
export { default as aiApi } from './aiApi';
export { default as messageApi } from './messageApi';
export { default as storyApi } from './storyApi';
export { default as exploreApi } from './exploreApi';

// Notification API
export {
  useGetNotificationsQuery,
  useGetNotificationSummaryQuery,
  useRegisterFCMTokenMutation,
  useDeactivateFCMTokenMutation,
  useMarkNotificationAsReadMutation,
  useMarkAllNotificationsAsReadMutation,
  useDeleteNotificationMutation,
  useSendTestNotificationMutation,
} from './notificationApi';

export type {
  NotificationActor,
  Notification,
  NotificationsResponse,
  NotificationSummaryResponse,
  RegisterTokenRequest,
  RegisterTokenResponse,
} from './notificationApi';

// Post API
export {
  useGetAllPostsQuery,
  useGetUserPostsQuery,
  useGetPostByIdQuery,
  useCreatePostMutation,
  useLikePostMutation,
  useAddCommentMutation,
  useDeletePostMutation,
  useUpdatePostMutation,
} from './postApi';

export type {
  Post,
  Comment,
  PostsResponse,
  SinglePostResponse,
  CreatePostRequest,
  CommentRequest,
} from './postApi';

// Explore API
export {
  useGetExploreQuery,
  useSearchUsersQuery,
  useSearchPostsQuery,
  useSearchHashtagsQuery,
} from './exploreApi';

export type {
  ExploreAuthor,
  ExplorePost,
  ExploreUser,
  HashtagItem,
  ExplorePostsResponse,
  ExplorePeopleResponse,
  SearchPostsResponse,
  SearchUsersResponse,
  SearchHashtagsResponse,
} from './exploreApi';

// User API
export {
  useLoginMutation,
  useRegisterMutation,
  useGetAllUsersQuery,
  useGetUserByIdQuery,
  useFollowUserMutation,
  useUnfollowUserMutation,
  useCheckIfFollowedQuery,
  useGetFollowersListMutation,
  useGetFollowingListMutation,
  useUpdateProfileMutation,
  useChangePasswordMutation,
  useLogoutMutation,
} from './userApi';

export type {
  User,
  UserResponse,
  UsersResponse,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  UpdateProfileRequest,
} from './userApi';

// AI API
export {
  useUploadImageForAIMutation,
  useGenerateCaptionsMutation,
  useUploadAndGenerateCaptionsMutation,
  useRegenerateCaptionsMutation,
} from './aiApi';

export type {
  ImageUploadResponse,
  AICaptionResponse,
} from './aiApi';

// Message API
export {
  useGetConversationsQuery,
  useGetMessagesQuery,
  useSendMessageMutation,
  useMarkMessagesAsReadMutation,
  useDeleteMessageMutation,
  useGetUnreadCountQuery,
} from './messageApi';

export type {
  Message,
  Conversation,
  MessagesResponse,
  ConversationsResponse,
  SendMessageRequest,
  SendMessageResponse,
} from './messageApi';

// Story API
export {
  useGetStoriesFeedQuery,
  useGetUserStoriesQuery,
  useCreateStoryMutation,
  useDeleteStoryMutation,
  useMarkStoryViewedMutation,
} from './storyApi';

export type {
  StoryMedia,
  StoryUser,
  StoryItem,
  StoryGroup,
  StoriesFeedResponse,
  UserStoriesResponse,
} from './storyApi';
