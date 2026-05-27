import { supabase } from './supabaseClient';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error('You need to be signed in to manage push notifications.');
  }

  return data.user.id;
}

export function isPushSupported() {
  return (
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function getPushSupportMessage() {
  if (!window.isSecureContext) {
    return 'Push notifications require HTTPS, or localhost during development. Open the app from a secure address before enabling push.';
  }

  if (!('serviceWorker' in navigator)) {
    return 'Service workers are not supported in this browser.';
  }

  if (!('PushManager' in window)) {
    return 'Web push is not supported in this browser.';
  }

  if (!('Notification' in window)) {
    return 'Notifications are not supported in this browser.';
  }

  return null;
}

function getPushSubscriptionError(error: unknown) {
  if (
    error instanceof DOMException &&
    error.name === 'SecurityError'
  ) {
    if (error.message.includes('unsupported MIME type')) {
      return new Error(
        'The service worker file was not served as JavaScript. Restart the dev server so /sw.js is available, then try enabling push again.',
      );
    }

    const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
    const isLocalhost = window.location.hostname === 'localhost';

    if (window.isSecureContext && isFirefox && isLocalhost) {
      return new Error(
        'Firefox blocked push subscription on localhost even though the page is secure. Try Chrome/Edge for local testing, or run PantrySync over HTTPS. Also make sure this is not a Private Window and site data/cookies are not blocked.',
      );
    }

    return new Error(
      'The browser blocked push as insecure. Use HTTPS, or localhost during development, then try again.',
    );
  }

  if (
    error instanceof Error &&
    error.message.toLowerCase().includes('insecure')
  ) {
    if (error.message.includes('unsupported MIME type')) {
      return new Error(
        'The service worker file was not served as JavaScript. Restart the dev server so /sw.js is available, then try enabling push again.',
      );
    }

    const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
    const isLocalhost = window.location.hostname === 'localhost';

    if (window.isSecureContext && isFirefox && isLocalhost) {
      return new Error(
        'Firefox blocked push subscription on localhost even though the page is secure. Try Chrome/Edge for local testing, or run PantrySync over HTTPS. Also make sure this is not a Private Window and site data/cookies are not blocked.',
      );
    }

    return new Error(
      'The browser blocked push as insecure. Use HTTPS, or localhost during development, then try again.',
    );
  }

  return error instanceof Error ? error : new Error('Could not enable push notifications.');
}

export function getNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }

  return Notification.permission;
}

export async function registerPushServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported on this browser.');
  }

  const existing = await navigator.serviceWorker.getRegistration('/');

  if (existing) {
    return existing;
  }

  return navigator.serviceWorker.register('/sw.js', {
    scope: '/',
  });
}

export async function subscribeToPushNotifications(householdId: string) {
  const supportMessage = getPushSupportMessage();

  if (supportMessage) {
    throw new Error(supportMessage);
  }

  const permission = await Notification.requestPermission();

  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

  if (!vapidPublicKey) {
    throw new Error('Missing VITE_VAPID_PUBLIC_KEY.');
  }

  const userId = await getCurrentUserId();
  const registration = await registerPushServiceWorker();
  const existingSubscription = await registration.pushManager.getSubscription();
  let subscription: PushSubscription;

  try {
    subscription =
      existingSubscription ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      }));
  } catch (err) {
    throw getPushSubscriptionError(err);
  }
  const subscriptionJson = subscription.toJSON();
  const endpoint = subscriptionJson.endpoint;
  const p256dh = subscriptionJson.keys?.p256dh;
  const auth = subscriptionJson.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    throw new Error('Browser returned an invalid push subscription.');
  }

  const { error: subscriptionError } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        household_id: householdId,
        endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent,
        platform: 'web',
        enabled: true,
      },
      {
        onConflict: 'user_id,endpoint',
      },
    );

  if (subscriptionError) {
    throw subscriptionError;
  }

  const { error: preferenceError } = await supabase
    .from('notification_preferences')
    .update({ push_enabled: true })
    .eq('household_id', householdId)
    .eq('user_id', userId);

  if (preferenceError) {
    throw preferenceError;
  }
}

export async function disablePushNotifications(householdId: string) {
  const userId = await getCurrentUserId();

  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.getRegistration('/');
    const subscription = await registration?.pushManager.getSubscription();
    await subscription?.unsubscribe();
  }

  const { error: subscriptionError } = await supabase
    .from('push_subscriptions')
    .update({ enabled: false })
    .eq('household_id', householdId)
    .eq('user_id', userId);

  if (subscriptionError) {
    throw subscriptionError;
  }

  const { error: preferenceError } = await supabase
    .from('notification_preferences')
    .update({ push_enabled: false })
    .eq('household_id', householdId)
    .eq('user_id', userId);

  if (preferenceError) {
    throw preferenceError;
  }
}

export async function sendTestPushNotification(householdId: string) {
  const { data, error } = await supabase.functions.invoke<{ ok: boolean }>(
    'test-push-notification',
    {
      body: {
        household_id: householdId,
      },
    },
  );

  if (error) {
    throw error;
  }

  if (!data?.ok) {
    throw new Error('Push test was not sent.');
  }
}
