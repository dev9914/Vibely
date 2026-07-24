import { useState, useEffect, useCallback } from 'react';
import { 
  requestNotificationPermission, 
  getFCMToken, 
  onMessageListener 
} from '../config/firebase';
import { 
  useRegisterFCMTokenMutation, 
  useDeactivateFCMTokenMutation 
} from '../services/notificationApi';
import { toast } from 'sonner';

interface UseNotificationsReturn {
  permission: NotificationPermission;
  token: string | null;
  isSupported: boolean;
  isRegistered: boolean;
  requestPermission: () => Promise<NotificationPermission>;
  registerToken: () => Promise<void>;
  deactivateToken: () => Promise<void>;
  listenToForeground: () => void;
}

type FcmForegroundPayload = {
  notification?: {
    title?: string;
    body?: string;
  };
  fcmOptions?: {
    link?: string;
  };
  [key: string]: unknown;
};

/**
 * Custom hook for managing push notifications
 * 
 * Features:
 * - Request notification permission
 * - Get and register FCM token
 * - Listen for foreground messages
 * - Auto-register on mount (if permission granted)
 * - Deactivate token on logout
 */
export const useNotifications = (): UseNotificationsReturn => {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [token, setToken] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);

  const [registerFCMToken] = useRegisterFCMTokenMutation();
  const [deactivateFCMToken] = useDeactivateFCMTokenMutation();

  // Check if notifications are supported
  useEffect(() => {
    const supported = 'Notification' in window && 'serviceWorker' in navigator;
    setIsSupported(supported);

    if (!supported) {
      console.warn('⚠️  Push notifications are not supported in this browser');
    }
  }, []);

  /**
   * Request notification permission from user
   */
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    try {
      const newPermission = await requestNotificationPermission();
      setPermission(newPermission);
      
      if (newPermission === 'granted') {
        toast.success('Notifications enabled!');
      } else if (newPermission === 'denied') {
        toast.error('Notification permission denied');
      }
      
      return newPermission;
    } catch (error) {
      console.error('Error requesting permission:', error);
      toast.error('Failed to request notification permission');
      return 'denied';
    }
  }, []);

  /**
   * Register FCM token with backend
   */
  const registerToken = useCallback(async (): Promise<void> => {
    try {
      console.log('[useNotifications] registerToken() called', {
        permission,
        isSupported,
      });

      if (permission !== 'granted') {
        console.log('⚠️  Permission not granted. Request permission first.');
        return;
      }

      // Get FCM token
      const fcmToken = await getFCMToken();
      
      if (!fcmToken) {
        console.error('❌ Failed to get FCM token');
        return;
      }

      setToken(fcmToken);

      // Register token with backend
      const result = await registerFCMToken({
        token: fcmToken,
        platform: 'web',
        userAgent: navigator.userAgent,
      }).unwrap();

      if (result.success) {
        setIsRegistered(true);
        setDeviceId(result.deviceId);
        console.log('✅ FCM token registered with backend');
        toast.success('Push notifications activated!');
      }
    } catch (error: unknown) {
      console.error('❌ Error registering token:', error);
      
      // Check if user is authenticated
      if (typeof error === 'object' && error !== null && 'status' in error && (error as { status?: number }).status === 401) {
        console.log('ℹ️  User not authenticated. Token will be registered after login.');
      } else {
        toast.error('Failed to activate push notifications');
      }
    }
  }, [permission, isSupported, registerFCMToken]);

  /**
   * Deactivate FCM token (on logout)
   */
  const deactivateToken = useCallback(async (): Promise<void> => {
    try {
      if (!deviceId) {
        console.log('ℹ️  No device ID to deactivate');
        return;
      }

      await deactivateFCMToken({ deviceId }).unwrap();
      
      setToken(null);
      setIsRegistered(false);
      setDeviceId(null);
      
      console.log('✅ FCM token deactivated');
    } catch (error) {
      console.error('❌ Error deactivating token:', error);
    }
  }, [deviceId, deactivateFCMToken]);

  /**
   * Listen for foreground messages and show toast
   */
  const listenToForeground = useCallback((): void => {
    console.log('[useNotifications] listenToForeground() attaching listener');

    onMessageListener((payload: FcmForegroundPayload) => {
      console.log('📬 Foreground notification received:', payload);
      
      const title = payload.notification?.title || payload.data?.title || 'New Notification';
      const body = payload.notification?.body || payload.data?.body || '';
      
      // Show toast notification
      toast(title, {
        description: body,
        action: payload.fcmOptions?.link || payload.data?.link ? {
          label: 'View',
          onClick: () => {
            window.location.href = (payload.fcmOptions?.link || payload.data?.link) as string || '/';
          }
        } : undefined,
        duration: 5000,
      });

      // Play notification sound (optional)
      try {
        const audio = new Audio('/notification-sound.mp3');
        audio.play().catch(() => {
          // Silently fail if sound can't play
        });
      } catch {
        // Ignore sound errors
      }
    });
  }, []);

  // Auto-register on mount if permission already granted
  useEffect(() => {
    if (isSupported && permission === 'granted' && !isRegistered) {
      registerToken();
    }
  }, [isSupported, permission, isRegistered, registerToken]);

  // Start listening for foreground messages
  useEffect(() => {
    if (isSupported && permission === 'granted') {
      listenToForeground();
    }
  }, [isSupported, permission, listenToForeground]);

  return {
    permission,
    token,
    isSupported,
    isRegistered,
    requestPermission,
    registerToken,
    deactivateToken,
    listenToForeground,
  };
};
