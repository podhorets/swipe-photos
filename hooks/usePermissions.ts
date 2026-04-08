import { useState, useEffect } from 'react';
import * as MediaLibrary from 'expo-media-library';
import * as Notifications from 'expo-notifications';

export function usePermissions() {
  const [mediaStatus, requestMedia] = MediaLibrary.usePermissions();
  const [notifGranted, setNotifGranted] = useState(false);

  useEffect(() => {
    Notifications.getPermissionsAsync().then((s) => setNotifGranted(s.granted));
  }, []);

  async function requestNotifications() {
    const result = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    setNotifGranted(result.granted);
    return result;
  }

  return {
    mediaStatus,
    requestMedia,
    requestNotifications,
    isMediaGranted: mediaStatus?.granted ?? false,
    isMediaLimited: mediaStatus?.granted && mediaStatus?.accessPrivileges === 'limited',
    isNotifGranted: notifGranted,
  };
}
