import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

import { apiRequest } from "@/lib/api";

function firebaseConfig() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!apiKey || !authDomain || !projectId || !messagingSenderId || !appId || !vapidKey) {
    return null;
  }
  return { apiKey, authDomain, projectId, messagingSenderId, appId, vapidKey };
}

export async function registerHrPush(): Promise<void> {
  const config = firebaseConfig();
  if (!config || typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    return;
  }
  if (!(await isSupported())) return;

  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return;

  const app = getApps()[0] ?? initializeApp({
    apiKey: config.apiKey,
    authDomain: config.authDomain,
    projectId: config.projectId,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  });
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey: config.vapidKey, serviceWorkerRegistration: registration });
  if (!token) return;
  await apiRequest("/users/fcm-token", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}
