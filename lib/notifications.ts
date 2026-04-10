import * as Notifications from 'expo-notifications';
import { getOnThisDay } from '@/lib/gallery/grouper';
import { yearsAgoLabel } from '@/lib/dateUtils';
import type { AssetMeta } from '@/types';

export const ON_THIS_DAY_NOTIFICATION_ID = 'on-this-day-daily';

/**
 * Schedules (or reschedules) a daily "On This Day" notification at 9:00 AM local time.
 * - Cancels any existing scheduled notification first to avoid duplicates.
 * - Skips scheduling if the gallery index is empty or there are no memories for today.
 * - Requires notification permission to already be granted; call after permission check.
 */
export async function scheduleOnThisDayNotification(index: AssetMeta[]): Promise<void> {
  // Cancel the existing notification before rescheduling
  await Notifications.cancelScheduledNotificationAsync(ON_THIS_DAY_NOTIFICATION_ID).catch(() => {
    // Ignore if it didn't exist
  });

  const memories = getOnThisDay(index, new Date());
  if (memories.length === 0) return;

  // Count distinct past years represented in today's memories
  const years = new Set(
    memories.map((a) => new Date(a.creationTime).getFullYear()),
  );
  const oldestYear = Math.min(...Array.from(years));
  const yearLabel = yearsAgoLabel(oldestYear);
  const photoWord = memories.length === 1 ? 'photo' : 'photos';

  await Notifications.scheduleNotificationAsync({
    identifier: ON_THIS_DAY_NOTIFICATION_ID,
    content: {
      title: 'On This Day',
      body: `You have ${memories.length} ${photoWord} from ${yearLabel} today`,
      sound: true,
      data: { navigateTo: 'on-this-day' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 9,
      minute: 0,
    },
  });
}

/**
 * Cancels the On This Day daily notification (e.g. when user disables notifications in settings).
 */
export async function cancelOnThisDayNotification(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(ON_THIS_DAY_NOTIFICATION_ID).catch(() => {});
}
