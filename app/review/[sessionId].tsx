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
import { SessionComplete } from '@/components/ui/SessionComplete';
import { AmbientPhotoBackdrop } from '@/components/ui/AmbientPhotoBackdrop';
import { REVIEW_CARD } from '@/constants/theme';
import type { Category } from '@/types';
import { posthog } from '@/lib/posthog';

// Must match SwipeCard/SwipeStack so the off-screen decode happens at the same size
// that SDWebImage will serve from its memory cache when the stack renders.
const PRELOAD_CARD_WIDTH = REVIEW_CARD.width;
const PRELOAD_CARD_HEIGHT = REVIEW_CARD.height;
const PRELOAD_TIMEOUT_MS = 2000;

function GlassCircleButton({
  icon,
  onPress,
  size = 40,
  iconSize = 20,
  label,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  size?: number;
  iconSize?: number;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="items-center justify-center rounded-full bg-[rgba(24,24,28,0.6)] border border-white/[0.16] active:opacity-70"
      style={{ width: size, height: size }}
    >
      <Ionicons name={icon} size={iconSize} color="white" />
    </Pressable>
  );
}

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

  const [showComplete, setShowComplete] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const preloadTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // First 3 URIs to pre-decode off-screen before showing the stack.
  // Stable for the session lifetime since uriById is a snapshot.
  const preloadUris = useMemo(
    () => session?.assetIds.slice(0, 3).map(id => uriById.get(id)).filter((u): u is string => !!u) ?? [],
    [session?.id, uriById],
  );

  // Reset when session identity changes (navigating to a new session)
  useEffect(() => {
    setSessionReady(false);
  }, [session?.id]);

  // Fallback: show the stack after PRELOAD_TIMEOUT_MS even if onLoad never fires
  // (e.g. iCloud-only asset that needs to download before decode).
  useEffect(() => {
    if (phase !== 'active' || sessionReady) return;
    clearTimeout(preloadTimeoutRef.current);
    preloadTimeoutRef.current = setTimeout(() => setSessionReady(true), PRELOAD_TIMEOUT_MS);
    return () => clearTimeout(preloadTimeoutRef.current);
  }, [phase, session?.id, sessionReady]);

  const handleTopCardPreloaded = useCallback(() => {
    clearTimeout(preloadTimeoutRef.current);
    setSessionReady(true);
  }, []);

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
      posthog.capture('review_session_completed', {
        category: sessionId,
        total_count: totalCount,
        kept_count: allIds.length,
      });
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
      const reviewedCount = Object.keys(decisions).length;
      posthog.capture('review_session_abandoned', {
        category: sessionId,
        reviewed_count: reviewedCount,
        total_count: totalCount,
      });
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

  if (phase !== 'active' || !session || !sessionReady) {
    return (
      <View className="flex-1 bg-bg-dark items-center justify-center">
        <Text className="text-white/50">Loading session…</Text>
        {/* Off-screen pre-decode: render first 3 cards at exact card size so SDWebImage
            populates its memory cache before SwipeStack mounts. Once the top card fires
            onLoad, sessionReady → true and the stack replaces this view. */}
        {phase === 'active' && preloadUris.map((uri, i) => (
          <Image
            key={uri}
            source={{ uri }}
            style={{ position: 'absolute', top: -9999, width: PRELOAD_CARD_WIDTH, height: PRELOAD_CARD_HEIGHT }}
            contentFit="cover"
            onLoad={i === 0 ? handleTopCardPreloaded : undefined}
          />
        ))}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg-dark">
      {/* Ambient echo of the current photo */}
      <AmbientPhotoBackdrop uri={uriById.get(visibleAssetIds[0] ?? '')} />

      {/* Header */}
      <View
        className="flex-row items-center px-5 pb-2.5 gap-3"
        style={{ paddingTop: insets.top + 12 }}
      >
        <GlassCircleButton icon="close" onPress={handleClose} label="Close session" />

        <View className="flex-1 items-center">
          <Text className="text-white font-bold text-base" style={{ letterSpacing: -0.2 }}>
            {session.label}
          </Text>
          <Text className="text-white/55 text-xs mt-px">
            {remainingCount} of {totalCount} left
          </Text>
        </View>

        {/* Undo button — fades in after first swipe */}
        <Animated.View style={undoAnimStyle} pointerEvents="box-none">
          <GlassCircleButton
            icon="arrow-undo-outline"
            iconSize={18}
            onPress={handleUndo}
            label="Undo last swipe"
          />
        </Animated.View>
      </View>

      {/* Progress bar */}
      <ProgressBar progress={progressFraction} />

      {/* Swipe stack */}
      <View className="flex-1 items-center justify-center mt-3.5">
        <SwipeStack
          ref={swipeStackRef}
          onDoubleTap={handleDoubleTap}
          onSessionComplete={handleSessionComplete}
        />
      </View>

      {/* Action bar — delete · hint · keep */}
      <View
        className="flex-row items-center justify-center gap-10"
        style={{ paddingBottom: insets.bottom + 24 }}
      >
        <ActionButton type="delete" onPress={handleSwipeLeft} />
        <Text
          className="text-white/40 text-[11px] font-semibold"
          style={{ letterSpacing: 0.88 }}
        >
          SWIPE OR TAP
        </Text>
        <ActionButton type="keep" onPress={handleSwipeRight} />
      </View>

      {/* Session complete screen — only shown when zero deletions (trash path skips this) */}
      {showComplete && (
        <SessionComplete
          totalCount={totalCount}
          keptCount={completionCounts.keptCount}
          freedBytes={0}
          onDone={() => router.back()}
        />
      )}
    </View>
  );
}
