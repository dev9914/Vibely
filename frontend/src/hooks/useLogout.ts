import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout as logoutAction } from '@/store/authSlice';
import { resetMessaging } from '@/store/messagingSlice';
import { useLogoutMutation } from '@/services/userApi';
import { api } from '@/services/api';
import { clearAccessToken } from '@/lib/authToken';
import { disconnectSocket } from '@/lib/socket';

/**
 * Centralized logout flow:
 * 1. Invalidate refresh token on the server and clear httpOnly cookies
 * 2. Clear Redux auth state
 * 3. Reset RTK Query cache
 * 4. Redirect to sign-in
 */
export function useLogout() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [logoutRequest, { isLoading }] = useLogoutMutation();

  const logout = useCallback(async () => {
    try {
      await logoutRequest().unwrap();
    } catch {
      // Still clear client state if the token is expired or the request fails
    } finally {
      clearAccessToken();
      disconnectSocket();
      dispatch(logoutAction());
      dispatch(resetMessaging());
      dispatch(api.util.resetApiState());
      navigate('/signin', { replace: true });
    }
  }, [dispatch, logoutRequest, navigate]);

  return { logout, isLoading };
}
