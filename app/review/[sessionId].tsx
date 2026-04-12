import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSession } from '@/hooks/useSession';
import { useGalleryStore } from '@/stores/galleryStore';
import { useSessionStore } from '@/stores/sessionStore';
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
    decisions,
    startSession,
    swipeLeft,
    swipeRight,
    swipeUp,
    undoLast,
  } = useSession();

  const galleryIndex = useGalleryStore((s) => s.index);
  const uriById = useMemo(
    () => new Map(galleryIndex.map((a) => [a.id, a.uri])),
    [galleryIndex],
  );
  const currentUri = visibleAssetIds[0] ? (uriById.get(visibleAssetIds[0]) ?? null) : null;

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

  function handleSwipeUp() {
    const assetId = visibleAssetIds[0];
    if (assetId) swipeUp(assetId);
  }

  function handleUndo() {
    undoOpacity.value = withTiming(0, { duration: 150 });
    if (undoDismissTimer.current) clearTimeout(undoDismissTimer.current);
    undoLast();
  }

  const handleSessionComplete = useCallback(() => {
    const currentDecisions = useSessionStore.getState().decisions;
    const staged = Object.values(currentDecisions).filter((d) => d === 'delete').length;

    // TODO decisions are not updated after session is finished (click on category after finished session)
    console.log(staged, 'staged');
    if (staged > 0) {
      // Signal to trash that it should build the summary after deletion
      useSessionStore.getState().setSessionFlowPending(true);
      router.back();
      router.push('/trash');
    } else {
      // No deletions — show summary inline immediately
      setShowComplete(true);
    }
  }, []);

  const handleDoubleTap = useCallback((assetId: string) => {
    router.push(`/review/preview/${assetId}`);
  }, []);

  const stagedCount = Object.values(decisions).filter((d) => d === 'delete').length;
  const keptCount = Object.values(decisions).filter((d) => d === 'keep').length;
  const favoritedCount = Object.values(decisions).filter((d) => d === 'favorite').length;

  if (!session) {
    return (
      <View className="flex-1 bg-black items-center justify-center">
        <Text className="text-white/50">Loading session…</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {/* Blurred dynamic background */}
      {currentUri && (
        <View className="absolute inset-0">
          <Image
            source={{ uri: currentUri }}
            style={{ flex: 1 }}
            contentFit="cover"
            transition={{ duration: 500, effect: 'cross-dissolve', timing: 'ease-in-out' }}
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
          onPress={() => router.back()}
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

      {/* Action buttons */}
      <View
        className="flex-row items-center justify-center gap-8"
        style={{ paddingBottom: insets.bottom + 24 }}
      >
        <ActionButton type="delete" onPress={handleSwipeLeft} />
        <ActionButton type="keep" onPress={handleSwipeRight} />
        <ActionButton type="favorite" onPress={handleSwipeUp} />
      </View>

      {/* Session complete sheet — only shown when zero deletions (trash path skips this) */}
      {showComplete && (
        <SessionCompleteSheet
          totalCount={totalCount}
          stagedCount={stagedCount}
          keptCount={keptCount}
          favoritedCount={favoritedCount}
          showReviewTrash={false}
          onDone={() => router.back()}
        />
      )}
    </View>
  );
}
