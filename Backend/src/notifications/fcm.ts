import { env } from "../config/env.js";

interface PushPayload {
  title: string;
  body: string;
  href: string;
  type: string;
  refId: string;
}

interface MessagingClient {
  sendEachForMulticast: (payload: {
    tokens: string[];
    notification: { title: string; body: string };
    data: Record<string, string>;
    webpush?: { fcmOptions?: { link: string } };
  }) => Promise<{
    failureCount: number;
    responses: Array<{ success: boolean; error?: { code?: string } }>;
  }>;
}

let messaging: MessagingClient | null | undefined;

async function getMessaging(): Promise<MessagingClient | null> {
  if (messaging !== undefined) return messaging;
  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    messaging = null;
    return null;
  }

  const { initializeApp, cert, getApps } = await import("firebase-admin/app");
  const { getMessaging: loadMessaging } = await import("firebase-admin/messaging");
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY,
      }),
    });
  }
  messaging = loadMessaging() as unknown as MessagingClient;
  return messaging;
}

export async function sendHrPush(tokens: string[], payload: PushPayload): Promise<string[]> {
  const unique = [...new Set(tokens.filter(Boolean))];
  if (unique.length === 0) return [];

  const client = await getMessaging();
  if (!client) {
    return [];
  }

  const result = await client.sendEachForMulticast({
    tokens: unique,
    notification: { title: payload.title, body: payload.body },
    data: {
      href: payload.href,
      type: payload.type,
      refId: payload.refId,
    },
    webpush: {
      fcmOptions: { link: `${env.FRONTEND_URL}${payload.href}` },
    },
  });

  const stale: string[] = [];
  result.responses.forEach((item, index) => {
    if (item.success) return;
    const code = item.error?.code;
    if (
      code === "messaging/registration-token-not-registered" ||
      code === "messaging/invalid-registration-token"
    ) {
      const token = unique[index];
      if (token) stale.push(token);
    }
  });
  return stale;
}
