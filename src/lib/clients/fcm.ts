/**
 * Firebase Cloud Messaging — server-side (firebase-admin).
 *
 * Sends push notifications to registered device tokens.
 * Token management (register/deregister) is handled via the /api/fcm/token route.
 */

import admin from "firebase-admin";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Admin SDK singleton
// ---------------------------------------------------------------------------

function getAdminApp(): admin.app.App {
  if (admin.apps.length) return admin.apps[0]!;

  const credentials = process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (!credentials) {
    throw new Error("FIREBASE_ADMIN_CREDENTIALS environment variable is not set");
  }

  return admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(credentials)),
  });
}

function getMessaging(): admin.messaging.Messaging {
  return admin.messaging(getAdminApp());
}

// ---------------------------------------------------------------------------
// Notification payload types
// ---------------------------------------------------------------------------

export interface PushPayload {
  title: string;
  body: string;
  /** Deep-link path within the app, e.g. "/league/abc123" */
  link?: string;
  /** Optional small data bag for client-side handling */
  data?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Core send helpers
// ---------------------------------------------------------------------------

/**
 * Sends a push notification to all registered devices for a single user.
 * Silently removes stale tokens (InvalidRegistration / NotRegistered).
 */
export async function sendToUser(
  userId: string,
  payload: PushPayload
): Promise<void> {
  const rows = await prisma.fcmToken.findMany({ where: { userId } });
  if (rows.length === 0) return;

  const tokens = rows.map((r) => r.token);
  await sendToTokens(tokens, payload);
}

/**
 * Sends a push notification to all registered devices for multiple users.
 */
export async function sendToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<void> {
  if (userIds.length === 0) return;

  const rows = await prisma.fcmToken.findMany({
    where: { userId: { in: userIds } },
  });
  if (rows.length === 0) return;

  const tokens = rows.map((r) => r.token);
  await sendToTokens(tokens, payload);
}

async function sendToTokens(tokens: string[], payload: PushPayload): Promise<void> {
  const messaging = getMessaging();

  const message: admin.messaging.MulticastMessage = {
    tokens,
    notification: { title: payload.title, body: payload.body },
    webpush: payload.link
      ? { fcmOptions: { link: payload.link } }
      : undefined,
    data: payload.data,
  };

  const response = await messaging.sendEachForMulticast(message);

  // Prune tokens that are no longer valid
  const staleTokens: string[] = [];
  response.responses.forEach((resp, i) => {
    if (
      !resp.success &&
      (resp.error?.code === "messaging/registration-token-not-registered" ||
        resp.error?.code === "messaging/invalid-registration-token")
    ) {
      staleTokens.push(tokens[i]);
    }
  });

  if (staleTokens.length > 0) {
    await prisma.fcmToken.deleteMany({ where: { token: { in: staleTokens } } });
  }
}
