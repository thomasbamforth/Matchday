"use client";

import { useFcm } from "@/hooks/useFcm";
import NotificationPermissionBanner from "@/components/notifications/NotificationPermissionBanner";
import NotificationToast from "@/components/notifications/NotificationToast";

/**
 * Mounts in the authenticated app layout.
 * Manages push notification registration and renders:
 *  - NotificationPermissionBanner: contextual opt-in prompt (shown once)
 *  - NotificationToast: in-app banner for foreground FCM messages
 */
export default function FcmRegistrar() {
  const { permissionState, requestPermission, foregroundMessage, clearForegroundMessage } =
    useFcm();

  return (
    <>
      <NotificationPermissionBanner
        permissionState={permissionState}
        onEnable={requestPermission}
      />
      <NotificationToast
        message={foregroundMessage}
        onDismiss={clearForegroundMessage}
      />
    </>
  );
}
