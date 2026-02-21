"use client";

import { useEffect, useRef } from "react";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { getFirebaseApp } from "@/lib/firebaseClient";

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY!;

/**
 * Registers the FCM service worker, requests notification permission,
 * retrieves the device push token, and persists it via POST /api/fcm/token.
 *
 * Call once near the top of the authenticated app tree.
 */
export function useFcm(): void {
  const registered = useRef(false);

  useEffect(() => {
    if (registered.current) return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;

    registered.current = true;

    async function register() {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const swReg = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js"
        );

        // Pass Firebase config to the service worker
        const config = {
          apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
          appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        };
        swReg.active?.postMessage({ type: "FIREBASE_CONFIG", config });

        const app = getFirebaseApp();
        const messaging = getMessaging(app);

        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: swReg,
        });

        if (token) {
          await fetch("/api/fcm/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token, device: "web" }),
          });
        }

        // Handle foreground messages (show a toast / update UI)
        onMessage(messaging, (payload) => {
          const { title, body } = payload.notification ?? {};
          if (title && "Notification" in window && document.visibilityState !== "visible") {
            new Notification(title, { body: body ?? "" });
          }
        });
      } catch (err) {
        console.warn("[useFcm] Registration failed:", err);
      }
    }

    register();
  }, []);
}
