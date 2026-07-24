// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

console.log('[firebase-messaging-sw.js] service worker booted', {
  scope: self.registration.scope,
});

// Firebase configuration - MUST MATCH YOUR firebase.ts CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyAc8V0rPcrbIbnCdCKD1w8V11Eyipwmi3k",
  authDomain: "vibely-96e06.firebaseapp.com",
  projectId: "vibely-96e06",
  storageBucket: "vibely-96e06.firebasestorage.app",
  messagingSenderId: "831588783044",
  appId: "1:831588783044:web:98451411d31a8497ad8a91",
  measurementId: "G-XXGW7P7CP7"
};

// Initialize Firebase app
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  // Check if notification is already handled by browser
  if (payload.notification) {
    // Browser automatically shows it, so don't show manually
    // But make sure data is attached
    return;
  }

  // Get title and body from payload
  const notificationTitle =
    payload.data?.title ||
    "New Notification";

  const notificationOptions = {
    body:
      payload.data?.body ||
      "You have a new notification",
    icon: '/logo.png',
    badge: '/badge.png',
    tag: payload.data?.notificationId || 'default',
    data: {
      url: payload.fcmOptions?.link || payload.data?.link || '/',
      ...payload.data,
    },
    requireInteraction: false,
    vibrate: [200, 100, 200],
  };

  console.log('[firebase-messaging-sw.js] calling self.registration.showNotification', {
    notificationTitle,
    notificationOptions,
  });

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);
  
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      // Check if there's already a window/tab open
      for (const client of clientList) {
        if (client.url.includes(new URL(urlToOpen, self.location.origin).pathname) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If no window/tab is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
