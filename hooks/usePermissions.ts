import { useState, useEffect } from 'react';
import { AppState } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as Notifications from 'expo-notifications';

export function usePermissions() {
  const [mediaStatus, requestMedia, getMedia] = MediaLibrary.usePermissions();
  const [notifGranted, setNotifGranted] = useState(false);

  useEffect(() => {
    Notifications.getPermissionsAsync().then((s) => setNotifGranted(s.granted));
  }, []);

  // The hook reads the status once on mount. Re-read it whenever the app comes
  // back to the foreground: the system photo prompt (also triggered implicitly
  // by the first library fetch) and the Settings app both background us, and
  // without this the screen stays on "Photo Access Required" until a relaunch.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') getMedia();
    });
    return () => sub.remove();
  }, [getMedia]);

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
