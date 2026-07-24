import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// Firebase configuration - REPLACE WITH YOUR FIREBASE PROJECT CREDENTIALS
const firebaseConfig = {
  apiKey: "AIzaSyAc8V0rPcrbIbnCdCKD1w8V11Eyipwmi3k",
  authDomain: "vibely-96e06.firebaseapp.com",
  projectId: "vibely-96e06",
  storageBucket: "vibely-96e06.firebasestorage.app",
  messagingSenderId: "831588783044",
  appId: "1:831588783044:web:98451411d31a8497ad8a91",
  measurementId: "G-XXGW7P7CP7"
};

// VAPID key for push notifications - GET FROM FIREBASE CONSOLE
// Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
export const VAPID_KEY = 'BH_iLLGgB0ifuz0MmLP3Qma_e4dUfTu8KJZ3OexsW9wySUpfGeMno99Q37tsdTFNXtaX5L_ya_BfMlyOltoK7vY';

// Initialize Firebase
export const firebaseApp = initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging
let messaging: any = null;
let swRegistration: ServiceWorkerRegistration | null = null;

try {
  // Check if browser supports service workers and notifications
  if ('serviceWorker' in navigator && 'Notification' in window) {
    messaging = getMessaging(firebaseApp);

    // Register service worker
    console.log('[firebase.ts] navigator.serviceWorker.register("/firebase-messaging-sw.js")');
    navigator.serviceWorker.register('/firebase-messaging-sw.js')
      .then(async (registration) => {
        swRegistration = registration;

        const registrations = await navigator.serviceWorker.getRegistrations();
        console.log('[firebase.ts] serviceWorker.getRegistrations()', registrations.map((item) => ({
          scope: item.scope,
          activeScriptURL: item.active?.scriptURL || null,
          waitingScriptURL: item.waiting?.scriptURL || null,
          installingScriptURL: item.installing?.scriptURL || null,
        })));

        console.log('[firebase.ts] Service Worker registered successfully', {
          scope: registration.scope,
          activeScriptURL: registration.active?.scriptURL || null,
        });

        // Wait for service worker to be active
        if (registration.active) {
          console.log('[firebase.ts] Service Worker is already active');
        } else if (registration.installing) {
          registration.installing.addEventListener('statechange', (e: any) => {
            if (e.target.state === 'activated') {
              console.log('[firebase.ts] Service Worker activated');
            }
          });
        }
      })
      .catch((err) => {
        console.error('❌ Service Worker registration failed:', err);
      });
  } else {
    console.warn('⚠️  Browser does not support notifications or service workers');
  }
} catch (error) {
  console.error('❌ Error initializing Firebase Messaging:', error);
}

export { messaging, swRegistration };

/**
 * Get FCM token for push notifications
 * @returns {Promise<string | null>} FCM token or null
 */
export const getFCMToken = async (): Promise<string | null> => {
  try {
    if (!messaging) {
      console.warn('⚠️  Firebase messaging not initialized');
      return null;
    }

    // Wait for service worker to be ready
    if ('serviceWorker' in navigator) {
      console.log('[firebase.ts] waiting for navigator.serviceWorker.ready');
      const registration = await navigator.serviceWorker.ready;
      console.log('[firebase.ts] navigator.serviceWorker.ready resolved', {
        scope: registration.scope,
        activeScriptURL: registration.active?.scriptURL || null,
      });
      
      // Small delay to ensure SW is fully ready
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Request token
      console.log('[firebase.ts] getToken() with service worker registration');
      const currentToken = await getToken(messaging, { 
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration
      });
      
      if (currentToken) {
        console.log('✅ FCM token retrieved:', currentToken.substring(0, 20) + '...');
        return currentToken;
      } else {
        console.warn('⚠️  No FCM token available. Request permission first.');
        return null;
      }
    } else {
      console.warn('⚠️  Service workers not supported');
      return null;
    }
  } catch (error) {
    console.error('❌ Error getting FCM token:', error);
    throw error;
  }
};

/**
 * Listen for foreground messages
 * @param callback Function to call when a new message is received
 */
export const onMessageListener = (callback: (payload: any) => void): void => {
  if (!messaging) {
    console.warn("⚠️  Firebase messaging not initialized");
    return;
  }

  console.log("[firebase.ts] onMessage listener attached");
  onMessage(messaging, (payload) => {
    console.log("[firebase.ts] onMessage payload received:", payload);
    callback(payload);
  });
};

/**
 * Request notification permission
 * @returns {Promise<NotificationPermission>} Permission status
 */
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  try {
    if (!('Notification' in window)) {
      console.warn('⚠️  This browser does not support notifications');
      return 'denied';
    }

    const permission = await Notification.requestPermission();
    console.log('🔔 Notification permission:', permission);
    return permission;
  } catch (error) {
    console.error('❌ Error requesting notification permission:', error);
    return 'denied';
  }
};
