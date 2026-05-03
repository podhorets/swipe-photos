import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSession } from '@/hooks/useSession';
import { useSessionStore } from '@/stores/sessionStore';
import { useKeepStore } from '@/stores/keepStore';
import { useStreakStore } from '@/stores/streakStore';
import { SwipeStack, type SwipeStackHandle } from '@/components/swipe/SwipeStack';
import { ActionButton } from '@/components/ui/ActionButton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SessionCompleteSheet } from '@/components/ui/SessionCompleteSheet';
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
    undoLast,
  } = useSession();

  // Imperative handle on SwipeStack — button path calls dismiss() so the top
  // card's fly-off spring fires identically to a gesture swipe.
  const swipeStackRef = useRef<SwipeStackHandle>(null);

  // Read from the session URI snapshot — O(1) Map lookup, no gallery subscription.
  // This screen never touches galleryStore.index during an active session.
  const phase = useSessionStore((s) => s.phase);
  const uriById = useSessionStore((s) => s.uriSnapshot);
  const topAssetId = visibleAssetIds[0] ?? null;
  const currentUri = topAssetId ? (uriById.get(topAssetId) ?? null) : null;


  const [showComplete, setShowComplete] = useState(false);

  // Undo button visibility — fades in after first swipe and stays visible
  const undoOpacity = useSharedValue(0);
  const undoAnimStyle = useAnimatedStyle(() => ({ opacity: undoOpacity.value }));

  const showUndo = useCallback(() => {
    undoOpacity.value = withTiming(1, { duration: 150 });
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


  // Clear session store on unmount so the next ReviewScreen mount can't paint
  // the previous session's cards for one commit before its startSession effect
  // runs. The trash screen captures `decisions` synchronously in its own
  // useState initializer, which runs on its mount — which happens before this
  // cleanup fires — so deletion data is preserved across the navigation.
  useEffect(() => {
    return () => {
      useSessionStore.getState().resetSession();
    };
  }, []);

  function handleSwipeLeft() {
    swipeStackRef.current?.dismiss('left');
  }

  function handleSwipeRight() {
    swipeStackRef.current?.dismiss('right');
  }

  function handleUndo() {
    undoOpacity.value = withTiming(0, { duration: 150 });
    undoLast();
  }

  // Called by SwipeStack when all cards have been swiped
  const handleSessionComplete = useCallback(() => {
    // Guard against stale isComplete firing before startSession runs on fresh mount.
    // lastStartedKey is '' until ReviewScreen's own effect sets it — SwipeStack's
    // effect fires first (child before parent), so if it's still empty the signal
    // is from the previous session and should be ignored.
    if (useSessionStore.getState().phase !== 'active') return;

    const decisions = useSessionStore.getState().decisions;
    const deleteIds = Object.entries(decisions)
      .filter(([, d]) => d === 'delete')
      .map(([id]) => id);

    if (deleteIds.length > 0) {
      // replace() is a single nav mutation: review → trash, home beneath.
      // back() + push() would mutate the stack twice in the same frame while
      // Reanimated is tearing down, which is a documented crash site.
      router.replace('/trash');
    } else {
      // No deletions — save all as kept and show summary inline
      const allIds = Object.keys(decisions);
      if (allIds.length > 0) useKeepStore.getState().addMany(allIds);
      useStreakStore.getState().recordSession();
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
            onPress: () => router.replace('/trash'),
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

  if (phase !== 'active' || !session) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <Text className="text-white/50">Loading session…</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
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
          ref={swipeStackRef}
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
          freedBytes={0}
          onDone={() => router.back()}
        />
      )}
    </View>
  );
}
