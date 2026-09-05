import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { logout as logoutAuth } from '@/store/authSlice';
import {
  clearAccessToken,
  refreshAccessToken as refreshAccessTokenFromAuth,
} from '@/lib/authToken';
import { disconnectSocket, updateSocketAuth } from '@/lib/socket';
import { getApiBaseUrl } from '@/lib/apiConfig';

/**
 * Base RTK Query API Configuration
 * 
 * Features:
 * - Automatic request/response handling
 * - Built-in caching mechanism
 * - Automatic re-fetching on tag invalidation
 * - Authentication header injection with Bearer prefix
 * - Automatic token refresh on 401 errors
 * - Error handling
 */

// Mutex to prevent multiple simultaneous token refresh attempts
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

const baseQuery = fetchBaseQuery({
  baseUrl: getApiBaseUrl(),
  credentials: 'include',
});

/**
 * Attempt to refresh the access token
 */
const refreshToken = async (): Promise<boolean> => {
  const token = await refreshAccessTokenFromAuth();
  if (token) {
    updateSocketAuth(token);
    return true;
  }
  return false;
};

/**
 * Base query with automatic token refresh on 401 errors
 */
const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await baseQuery(args, api, extraOptions);

  if (result.error && result.error.status === 401) {
    if (!isRefreshing) {
      isRefreshing = true;

      refreshPromise = refreshToken().finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
    }

    if (!refreshPromise) {
      clearAccessToken();
      disconnectSocket();
      api.dispatch(logoutAuth());
      return result;
    }

    const refreshSuccess = await refreshPromise;

    if (refreshSuccess) {
      result = await baseQuery(args, api, extraOptions);
    } else {
      clearAccessToken();
      disconnectSocket();
      api.dispatch(logoutAuth());
    }
  }

  return result;
};

/**
 * Custom base query wrapper that combines token refresh with data extraction
 * Backend returns: { statusCode, data, message, success }
 * This wrapper:
 * 1. Handles 401 errors with automatic token refresh
 * 2. Extracts the 'data' property for cleaner consumption
 */
const baseQueryWithExtraction = async (args: any, api: any, extraOptions: any) => {
  const result = await baseQueryWithReauth(args, api, extraOptions);
  
  // If the response has data.data (nested data from ApiResponse), extract it
  if (result.data && typeof result.data === 'object' && 'data' in result.data) {
    return { ...result, data: result.data.data };
  }
  
  return result;
};

/**
 * Base API instance with tag-based cache invalidation
 * 
 * Tag Types:
 * - Post: All post-related data (feed, user posts, single post)
 * - User: User profiles, followers, following
 * - Comment: Comments on posts
 * - Notification: User notifications
 * - Message: Chat messages
 * - Conversation: Chat conversations
 */
export const api = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithExtraction,
  tagTypes: ['Post', 'User', 'Comment', 'Notification', 'Message', 'Conversation', 'Story', 'Explore'],
  endpoints: () => ({}), // Endpoints will be injected by specific API services
});

export default api;
