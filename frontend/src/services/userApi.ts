import { api } from './api';
import { storeAccessTokenFromAuthResponse } from '@/lib/authToken';

/**
 * User API Service
 * 
 * Handles all user-related endpoints including:
 * - User profiles
 * - Follow/Unfollow functionality
 * - User discovery
 * - Profile updates
 */

// ========== TYPES ==========

export interface User {
  _id: string;
  username: string;
  email: string;
  fullName: string;
  avatar: string;
  coverImage?: string;

  bio?: string;
  website?: string;
  location?: string;

  followers: string[];
  following: string[];
  noOfFollower: number | string;
  noOfFollowing: number | string;

  createdAt: string;
  updatedAt: string;
}

export interface UserResponse {
  success: boolean;
  user: User;
}

export interface UsersResponse {
  success: boolean;
  users: User[];
}

// Simplified user for follow lists (matches backend response)
export interface FollowListUser {
  _id: string;
  username: string;
  fullName: string;
  avatar: string;
}

export interface FollowListResponse {
  success: boolean;
  users: FollowListUser[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  fullName: string;
  avatar?: File;
}

/**
 * Login/Register Response
 * Note: baseQueryWithExtraction automatically unwraps the data property
 */
export interface AuthResponse {
  user: User;
  accessToken?: string;
}

export interface UpdateProfileRequest {
  fullName?: string;
  email?: string;
  avatar?: File;
  coverImage?: File;
}

// ========== API ENDPOINTS ==========

export const userApi = api.injectEndpoints({
  endpoints: (builder) => ({
    
    /**
     * Get current authenticated user details
     */
    getCurrentUser: builder.query<User, void>({
      query: () => '/users/getuserdetails',
      providesTags: ['User'],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(userApi.endpoints.getSocketToken.initiate(undefined, {
            forceRefetch: true,
          }));
        } catch {
          // handled by caller
        }
      },
    }),
    
    /**
     * Login user
     */
    login: builder.mutation<AuthResponse, LoginRequest>({
      query: (credentials) => ({
        url: '/users/login',
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: ['User'],
      async onQueryStarted(_arg, { queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          storeAccessTokenFromAuthResponse(data);
        } catch {
          // handled by caller
        }
      },
    }),
    
    /**
     * Register new user
     */
    register: builder.mutation<AuthResponse, FormData>({
      query: (formData) => ({
        url: '/users/register',
        method: 'POST',
        body: formData,
      }),
      async onQueryStarted(_arg, { queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          storeAccessTokenFromAuthResponse(data);
        } catch {
          // handled by caller
        }
      },
    }),

    getSocketToken: builder.query<{ accessToken: string }, void>({
      query: () => '/users/socket-token',
      async onQueryStarted(_arg, { queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          storeAccessTokenFromAuthResponse(data);
        } catch {
          // handled by caller
        }
      },
    }),
    
    /**
     * Get all users (for discovery/search)
     */
    getAllUsers: builder.query<UsersResponse, void>({
      query: () => '/users/getalluser',
      providesTags: (result) =>
        result?.users
          ? [
              ...result.users.map(({ _id }) => ({ type: 'User' as const, id: _id })),
              { type: 'User', id: 'LIST' },
            ]
          : [{ type: 'User', id: 'LIST' }],
    }),
    
    /**
     * Get user by ID
     */
    getUserById: builder.query<UserResponse, string>({
      query: (userId) => `/users/getuserbyId/${userId}`,
      providesTags: (_result, _error, userId) => [{ type: 'User', id: userId }],
    }),
    
    /**
     * Follow a user
     * Uses optimistic update for instant UI feedback
     */
    followUser: builder.mutation<{ success: boolean }, string>({
      query: (userId) => ({
        url: `/users/follow/${userId}`,
        method: 'POST',
      }),
      // Optimistic update
      async onQueryStarted(userId, { dispatch, queryFulfilled, getState }) {
        const state: any = getState();
        const currentUserId = state.auth.user?._id;
        
        // Update user profile cache
        const patchResult = dispatch(
          userApi.util.updateQueryData('getUserById', userId, (draft) => {
            if (!draft.user.followers.includes(currentUserId)) {
              draft.user.followers.push(currentUserId);
              draft.user.noOfFollower = Number(draft.user.noOfFollower) + 1;
              draft.user.isFollowing = true;
            }
          })
        );
        
        // Update all users list
        const patchList = dispatch(
          userApi.util.updateQueryData('getAllUsers', undefined, (draft) => {
            const user = draft.users.find((u) => u._id === userId);
            if (user && !user.followers.includes(currentUserId)) {
              user.followers.push(currentUserId);
              user.noOfFollower = Number(user.noOfFollower) + 1;
              user.isFollowing = true;
            }
          })
        );

        // Update follow status cache
        const patchFollowStatus = dispatch(
          userApi.util.updateQueryData('checkIfFollowed', userId, (draft) => {
            draft.isFollowing = true;
          })
        );
        
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
          patchList.undo();
          patchFollowStatus.undo();
        }
      },
      invalidatesTags: (_result, _error, userId) => [
        { type: 'User', id: userId },
        { type: 'User', id: 'LIST' },
        { type: 'User', id: `FOLLOW_${userId}` },
      ],
    }),
    
    /**
     * Unfollow a user
     * Uses optimistic update for instant UI feedback
     */
    unfollowUser: builder.mutation<{ success: boolean }, string>({
      query: (userId) => ({
        url: `/users/unfollow/${userId}`,
        method: 'POST',
      }),
      // Optimistic update
      async onQueryStarted(userId, { dispatch, queryFulfilled, getState }) {
        const state: any = getState();
        const currentUserId = state.auth.userData?._id;
        
        // Update user profile cache
        const patchResult = dispatch(
          userApi.util.updateQueryData('getUserById', userId, (draft) => {
            draft.user.followers = draft.user.followers.filter((id) => id !== currentUserId);
            draft.user.noOfFollower = Math.max(0, Number(draft.user.noOfFollower) - 1);
            draft.user.isFollowing = false;
          })
        );
        
        // Update all users list
        const patchList = dispatch(
          userApi.util.updateQueryData('getAllUsers', undefined, (draft) => {
            const user = draft.users.find((u) => u._id === userId);
            if (user) {
              user.followers = user.followers.filter((id) => id !== currentUserId);
              user.noOfFollower = Math.max(0, Number(user.noOfFollower) - 1);
              user.isFollowing = false;
            }
          })
        );

        // Update follow status cache
        const patchFollowStatus = dispatch(
          userApi.util.updateQueryData('checkIfFollowed', userId, (draft) => {
            draft.isFollowing = false;
          })
        );
        
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
          patchList.undo();
          patchFollowStatus.undo();
        }
      },
      invalidatesTags: (_result, _error, userId) => [
        { type: 'User', id: userId },
        { type: 'User', id: 'LIST' },
        { type: 'User', id: `FOLLOW_${userId}` },
      ],
    }),
    
    /**
     * Check if current user follows a specific user
     */
    checkIfFollowed: builder.query<{ success: boolean; isFollowing: boolean }, string>({
      query: (userId) => `/users/checkifFollwed/${userId}`,
      transformResponse: (response: { followed: boolean }) => ({
  success: true,
  isFollowing: response.followed || false,
}),
      providesTags: (_result, _error, userId) => [
        { type: 'User', id: `FOLLOW_${userId}` },
      ],
    }),
    
    /**
     * Get followers list
     */
    getFollowersList: builder.mutation<FollowListResponse, { following: string[] }>({
      query: (body) => ({
        url: '/users/followedlist',
        method: 'POST',
        body,
      }),
    }),
    
    /**
     * Get following list
     */
    getFollowingList: builder.mutation<FollowListResponse, { following: string[] }>({
      query: (body) => ({
        url: '/users/followedlist',
        method: 'POST',
        body,
      }),
    }),
    
    /**
     * Update user profile
     */
updateProfile: builder.mutation<
  UserResponse,
  {
    username?: string;
    fullName?: string;
    email?: string;
    bio?: string;
    website?: string;
    location?: string;
  }
>({
  query: (body) => ({
    url: '/users/update-account',
    method: 'PATCH',
    body,
  }),
  invalidatesTags: ['User'],
}),

updateAvatar: builder.mutation<UserResponse, FormData>({
  query: (formData) => ({
    url: '/users/avatar',
    method: 'PATCH',
    body: formData,
  }),
  invalidatesTags: ['User'],
}),

updateCoverImage: builder.mutation<UserResponse, FormData>({
  query: (formData) => ({
    url: '/users/cover-image',
    method: 'PATCH',
    body: formData,
  }),
  invalidatesTags: ['User'],
}),
    
    /**
     * Change password
     */
    changePassword: builder.mutation<
      { success: boolean },
      { oldPassword: string; newPassword: string }
    >({
      query: (body) => ({
        url: '/users/change-password',
        method: 'POST',
        body,
      }),
    }),
    
    /**
     * Logout user
     */
    logout: builder.mutation<{ success: boolean }, void>({
      query: () => ({
        url: '/users/logout',
        method: 'POST',
      }),
      invalidatesTags: ['User'],
    }),
  }),
});

// ========== EXPORT HOOKS ==========

/**
 * Auto-generated hooks for use in components
 * 
 * Usage:
 * const { data, isLoading } = useGetUserByIdQuery(userId);
 * const [followUser] = useFollowUserMutation();
 */
export const {
  useGetCurrentUserQuery,
  useGetSocketTokenQuery,
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
  useUpdateAvatarMutation,
useUpdateCoverImageMutation,
} = userApi;

export default userApi;
