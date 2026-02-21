"use client";

import { useFcm } from "@/hooks/useFcm";

/**
 * Mounts in the authenticated layout to register the FCM service worker
 * and persist the push token. Renders nothing — side-effect only.
 */
export default function FcmRegistrar() {
  useFcm();
  return null;
}
