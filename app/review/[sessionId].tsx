import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSession } from '@/hooks/useSession';
import { useGalleryStore } from '@/stores/galleryStore';
import { SwipeStack } from '@/components/swipe/SwipeStack';
import { ActionButton } from '@/components/ui/ActionButton';
import { UndoPill } from '@/components/ui/UndoPill';
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

  const [undoVisible, setUndoVisible] = useState(false);
  const [showComplete, setShowComplete] = useState(false);

  const didStart = useRef(false);
  useEffect(() => {
    if (didStart.current) return;
    didStart.current = true;
    startSession({
      category: sessionId as Category,
      yearFilter: year ? Number(year) : undefined,
      monthFilter: month,
    });
  }, [sessionId, year, month, startSession]);

  const currentIndex = totalCount - remainingCount;
  useEffect(() => {
    if (currentIndex > 0) setUndoVisible(true);
  }, [currentIndex]);

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
    setUndoVisible(false);
    undoLast();
  }

  const handleSessionComplete = useCallback(() => {
    setShowComplete(true);
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
      {/* ── Blurred dynamic background ──────────────────────────────────────── */}
      {currentUri && (
        <View className="absolute inset-0">
          <Image
            source={{ uri: currentUri }}
            style={{ flex: 1 }}
            contentFit="cover"
            // Cross-dissolves smoothly as the URI changes with each swipe
            transition={{ duration: 500, effect: 'cross-dissolve', timing: 'ease-in-out' }}
            blurRadius={18}
          />
          {/* Extra blur + dark tint so background never competes with the card */}
          <BlurView
            intensity={60}
            tint="dark"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <View className="absolute inset-0 bg-black/50" />
        </View>
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
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
          <Text className="text-white/40 text-xs mt-0.5">
            {remainingCount} remaining
          </Text>
        </View>
      </View>

      {/* ── Progress bar ────────────────────────────────────────────────────── */}
      <ProgressBar progress={progressFraction} />

      {/* ── Swipe stack ─────────────────────────────────────────────────────── */}
      <View className="flex-1 items-center justify-center mt-4">
        <SwipeStack
          onDoubleTap={handleDoubleTap}
          onSessionComplete={handleSessionComplete}
        />
      </View>

      {/* ── Action buttons ──────────────────────────────────────────────────── */}
      <View
        className="flex-row items-center justify-center gap-8"
        style={{ paddingBottom: insets.bottom + 24 }}
      >
        <ActionButton type="delete" onPress={handleSwipeLeft} />
        <ActionButton type="keep" onPress={handleSwipeRight} />
        <ActionButton type="favorite" onPress={handleSwipeUp} />
      </View>

      {/* ── Undo pill ───────────────────────────────────────────────────────── */}
      <UndoPill
        visible={undoVisible}
        onUndo={handleUndo}
        onDismiss={() => setUndoVisible(false)}
      />

      {/* ── Session complete sheet ───────────────────────────────────────────── */}
      {showComplete && (
        <SessionCompleteSheet
          totalCount={totalCount}
          stagedCount={stagedCount}
          keptCount={keptCount}
          favoritedCount={favoritedCount}
          onReviewTrash={() => {
            router.back();
            router.push('/trash');
          }}
          onDone={() => router.back()}
        />
      )}
    </View>
  );
}
