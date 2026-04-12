import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSession } from '@/hooks/useSession';
import { useGalleryStore } from '@/stores/galleryStore';
import { useSessionStore } from '@/stores/sessionStore';
import { useKeepStore } from '@/stores/keepStore';
import { SwipeStack } from '@/components/swipe/SwipeStack';
import { ActionButton } from '@/components/ui/ActionButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SessionCompleteSheet } from '@/components/ui/SessionCompleteSheet';
import { SESSION } from '@/constants/config';
import type { Category } from '@/types';

export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const { sessionId, year, month } = useLocalSearchParams<{
    sessionId: string;
    year?: string;
    month?: string;
  }>();

  const {
    session,
    progressFraction,
    remainingCount,
    totalCount,
    visibleAssetIds,
    startSession,
    swipeLeft,
    swipeRight,
    undoLast,
  } = useSession();

  const galleryIndex = useGalleryStore((s) => s.index);

  // Look up only the one URI we need (background) — no full Map required here
  const topAssetId = visibleAssetIds[0] ?? null;
  const currentUri = useMemo(
    () => topAssetId ? galleryIndex.find((a) => a.id === topAssetId)?.uri ?? null : null,
    [topAssetId, galleryIndex],
  );

  // Debounce background URI: only update after 350ms of inactivity so rapid swipes
  // don't trigger expensive Image + BlurView re-renders on every card change.
  // The fly-off animation leaves the screen in ~200–250ms, so 350ms ensures the
  // background updates after the departing card is already gone.
  const [bgUri, setBgUri] = useState<string | null>(currentUri);
  const bgTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(bgTimerRef.current);
    bgTimerRef.current = setTimeout(() => setBgUri(currentUri), 350);
    return () => clearTimeout(bgTimerRef.current);
  }, [currentUri]);

  const [showComplete, setShowComplete] = useState(false);

  // Undo button visibility — animated opacity in the header
  const undoOpacity = useSharedValue(0);
  const undoAnimStyle = useAnimatedStyle(() => ({ opacity: undoOpacity.value }));
  const undoDismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showUndo = useCallback(() => {
    if (undoDismissTimer.current) clearTimeout(undoDismissTimer.current);
    undoOpacity.value = withTiming(1, { duration: 150 });
    undoDismissTimer.current = setTimeout(() => {
      undoOpacity.value = withTiming(0, { duration: 300 });
    }, SESSION.undoPillDuration);
  }, [undoOpacity]);

  const sessionKey = `${sessionId}-${year ?? ''}-${month ?? ''}`;
  const lastStartedKey = useRef('');
  useEffect(() => {
    if (lastStartedKey.current === sessionKey) return;
    lastStartedKey.current = sessionKey;
    setShowComplete(false);
    startSession({
      category: sessionId as Category,
      yearFilter: year ? Number(year) : undefined,
      monthFilter: month,
    });
  }, [sessionKey, startSession]);

  const currentIndex = totalCount - remainingCount;
  useEffect(() => {
    if (currentIndex > 0) showUndo();
  }, [currentIndex, showUndo]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (undoDismissTimer.current) clearTimeout(undoDismissTimer.current);
    };
  }, []);

  function handleSwipeLeft() {
    const assetId = visibleAssetIds[0];
    if (assetId) swipeLeft(assetId);
  }

  function handleSwipeRight() {
    const assetId = visibleAssetIds[0];
    if (assetId) swipeRight(assetId);
  }

  function handleUndo() {
    undoOpacity.value = withTiming(0, { duration: 150 });
    if (undoDismissTimer.current) clearTimeout(undoDismissTimer.current);
    undoLast();
  }

  // Called by SwipeStack when all cards have been swiped
  const handleSessionComplete = useCallback(() => {
    // Guard against stale isComplete firing before startSession runs on fresh mount.
    // lastStartedKey is '' until ReviewScreen's own effect sets it — SwipeStack's
    // effect fires first (child before parent), so if it's still empty the signal
    // is from the previous session and should be ignored.
    if (!lastStartedKey.current) return;

    const decisions = useSessionStore.getState().decisions;
    const deleteIds = Object.entries(decisions)
      .filter(([, d]) => d === 'delete')
      .map(([id]) => id);

    if (deleteIds.length > 0) {
      // Navigate to trash with session's delete decisions
      // router.back() first so trash sits on top of home (not review)
      // router.back();
      router.push('/trash');
    } else {
      // No deletions — save all as kept and show summary inline
      const allIds = Object.keys(decisions);
      if (allIds.length > 0) useKeepStore.getState().addMany(allIds);
      setShowComplete(true);
    }
  }, []);

  // X button — handle mid-session close
  const handleClose = useCallback(() => {
    const decisions = useSessionStore.getState().decisions;
    const deleteCount = Object.values(decisions).filter((d) => d === 'delete').length;

    if (deleteCount > 0) {
      Alert.alert(
        'You have photos marked for deletion',
        `${deleteCount} photo${deleteCount === 1 ? '' : 's'} marked to delete.`,
        [
          {
            text: 'Discard & Close',
            style: 'cancel',
            onPress: () => router.back(),
          },
          {
            text: 'Review Trash',
            onPress: () => {
              router.back();
              router.push('/trash');
            },
          },
        ],
      );
    } else {
      // No deletes — just close without saving (abandoned session)
      router.back();
    }
  }, []);

  const handleDoubleTap = useCallback((assetId: string) => {
    router.push(`/review/preview/${assetId}`);
  }, []);

  // Counts for completion sheet (only computed when sheet is actually shown)
  const completionCounts = useMemo(() => {
    if (!showComplete) return { keptCount: 0 };
    const d = Object.values(useSessionStore.getState().decisions);
    return {
      keptCount: d.filter((v) => v === 'keep').length,
    };
  }, [showComplete]);

  if (!session) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <Text className="text-white/50">Loading session…</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {/* Blurred dynamic background — driven by debounced bgUri to avoid per-swipe re-renders */}
      {bgUri && (
        <View className="absolute inset-0">
          <Image
            source={{ uri: bgUri }}
            style={{ flex: 1 }}
            contentFit="cover"
            blurRadius={18}
          />
          <BlurView
            intensity={60}
            tint="dark"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <View className="absolute inset-0 bg-black/50" />
        </View>
      )}

      {/* Header */}
      <View
        className="flex-row items-center px-6 pb-3"
        style={{ paddingTop: insets.top + 12 }}
      >
        <Pressable
          onPress={handleClose}
          className="w-9 h-9 items-center justify-center rounded-full bg-white/10 mr-3"
        >
          <Ionicons name="close" size={20} color="white" />
        </Pressable>

        <View className="flex-1">
          <Text className="text-white font-semibold text-base">{session.label}</Text>
          <Text className="text-white/40 text-xs mt-0.5">{remainingCount} remaining</Text>
        </View>

        {/* Undo button — fades in after each swipe, auto-hides after 3s */}
        <Animated.View style={undoAnimStyle} pointerEvents="box-none">
          <Pressable
            onPress={handleUndo}
            className="flex-row items-center gap-1.5 px-3 py-2 rounded-full bg-white/10"
          >
            <Ionicons name="arrow-undo-outline" size={15} color="white" />
            <Text className="text-white text-sm font-medium">Undo</Text>
          </Pressable>
        </Animated.View>
      </View>

      {/* Progress bar */}
      <ProgressBar progress={progressFraction} />

      {/* Swipe stack */}
      <View className="flex-1 items-center justify-center mt-4">
        <SwipeStack
          onDoubleTap={handleDoubleTap}
          onSessionComplete={handleSessionComplete}
        />
      </View>

      {/* Action buttons — delete and keep only */}
      <View
        className="flex-row items-center justify-center gap-12"
        style={{ paddingBottom: insets.bottom + 24 }}
      >
        <ActionButton type="delete" onPress={handleSwipeLeft} />
        <ActionButton type="keep" onPress={handleSwipeRight} />
      </View>

      {/* Session complete sheet — only shown when zero deletions (trash path skips this) */}
      {showComplete && (
        <SessionCompleteSheet
          totalCount={totalCount}
          keptCount={completionCounts.keptCount}
          onDone={() => router.back()}
        />
      )}
    </View>
  );
}
