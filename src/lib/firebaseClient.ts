/**
 * Firebase web SDK singleton — browser only.
 * Used by useFcm hook to get/refresh the device push token.
 */

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

export function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
}
