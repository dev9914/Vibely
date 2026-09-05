import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { clearAccessToken } from "@/lib/authToken";

/**
 * Auth State Management
 * 
 * Centralized authentication state with proper token management
 */

export interface AuthUser {
  _id: string;
  username: string;
  email: string;
  fullName: string;
  coverImage?: string | null;
  avatar?: string | null;
  followers: string[];
  following: string[];
  noOfFollower: number;
  noOfFollowing: number;
}

interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  loading: boolean;
};

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  loading: true,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<{ user: AuthUser }>) => {
      state.isAuthenticated = true;
      state.user = action.payload.user;
      state.loading = false;
    },

    setUser: (state, action: PayloadAction<AuthUser>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },

    logout: (state) => {
      clearAccessToken();
      state.isAuthenticated = false;
      state.user = null;
      state.loading = false;
    },

    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
  },
});

// Export actions
export const {
  setCredentials,
  setUser,
  logout,
  setLoading,
} = authSlice.actions;

export const attachAuthSyncListeners = () => {
  // no-op currently
};

// Selectors
export const selectAuth = (state: { auth: AuthState }) => state.auth;
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated;
export const selectUser = (state: { auth: AuthState }) => state.auth.user;
export const selectIsLoading = (state: { auth: AuthState }) => state.auth.loading;

export default authSlice.reducer;