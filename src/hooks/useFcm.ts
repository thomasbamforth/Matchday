"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { getFirebaseApp } from "@/lib/firebaseClient";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!;

export type FcmPermissionState = "default" | "granted" | "denied" | "unsupported";

export interface ForegroundMessage {
  title: string;
  body: string;
  link?: string;
}

interface UseFcmResult {
  permissionState: FcmPermissionState;
  requestPermission: () => Promise<void>;
  foregroundMessage: ForegroundMessage | null;
  clearForegroundMessage: () => void;
}

function getPermissionState(): FcmPermissionState {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("Notification" in window)) return "unsupported";
  return Notification.permission as FcmPermissionState;
}

async function registerAndGetToken(): Promise<void> {
  const swReg = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

  // Pass Firebase config to the service worker
  const config = {
    apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  swReg.active?.postMessage({ type: "FIREBASE_CONFIG", config });

  const messaging = getMessaging(getFirebaseApp());
  const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });

  if (token) {
    await fetch("/api/fcm/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, device: "web" }),
    });
  }
}

/**
 * Manages FCM registration and foreground message delivery.
 *
 * Does NOT call Notification.requestPermission() automatically.
 * Call requestPermission() in response to explicit user action (banner button).
 *
 * If permission was already granted (returning user), silently re-registers.
 */
export function useFcm(): UseFcmResult {
  const [permissionState, setPermissionState] = useState<FcmPermissionState>("unsupported");
  const [foregroundMessage, setForegroundMessage] = useState<ForegroundMessage | null>(null);
  const registeredRef = useRef(false);

  // Read initial permission state and silently re-register if already granted
  useEffect(() => {
    const state = getPermissionState();
    setPermissionState(state);

    if (state === "granted" && !registeredRef.current) {
      registeredRef.current = true;
      registerAndGetToken().catch((err) => console.warn("[useFcm] Re-register failed:", err));

      // Set up foreground message listener
      try {
        const messaging = getMessaging(getFirebaseApp());
        onMessage(messaging, (payload) => {
          const { title, body } = payload.notification ?? {};
          if (title) {
            setForegroundMessage({
              title,
              body: body ?? "",
              link: payload.data?.link,
            });
          }
        });
      } catch {
        // Messaging not available in this environment
      }
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (registeredRef.current) return;
    try {
      const result = await Notification.requestPermission();
      setPermissionState(result as FcmPermissionState);

      if (result === "granted") {
        registeredRef.current = true;
        await registerAndGetToken();

        // Set up foreground message listener after grant
        const messaging = getMessaging(getFirebaseApp());
        onMessage(messaging, (payload) => {
          const { title, body } = payload.notification ?? {};
          if (title) {
            setForegroundMessage({
              title,
              body: body ?? "",
              link: payload.data?.link,
            });
          }
        });
      }
    } catch (err) {
      console.warn("[useFcm] Permission request failed:", err);
    }
  }, []);

  const clearForegroundMessage = useCallback(() => setForegroundMessage(null), []);

  return { permissionState, requestPermission, foregroundMessage, clearForegroundMessage };
}
