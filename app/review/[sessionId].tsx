import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSession } from '@/hooks/useSession';
import { SwipeStack } from '@/components/swipe/SwipeStack';
import { ActionButton } from '@/components/ui/ActionButton';
import { UndoPill } from '@/components/ui/UndoPill';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { GlassSheet } from '@/components/glass/GlassSheet';
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

  const [undoVisible, setUndoVisible] = useState(false);
  const [showComplete, setShowComplete] = useState(false);

  // Use a ref to start session only once on mount
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

  // Show undo pill after each swipe
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

  if (!session) {
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

      {/* Undo pill */}
      <UndoPill
        visible={undoVisible}
        onUndo={handleUndo}
        onDismiss={() => setUndoVisible(false)}
      />

      {/* Session complete sheet */}
      {showComplete && (
        <View className="absolute inset-0 justify-end">
          <GlassSheet>
            <View className="py-4 gap-4">
              <Text className="text-white text-2xl font-bold text-center">
                Session Complete 🎉
              </Text>
              <Text className="text-white/60 text-base text-center">
                {totalCount} reviewed · {stagedCount} to delete · {keptCount} kept
              </Text>

              <Pressable
                onPress={() => {
                  router.back();
                  router.push('/trash');
                }}
                className="bg-red-500/80 rounded-2xl py-4 items-center mt-2"
              >
                <Text className="text-white font-semibold text-base">
                  Review Trash ({stagedCount})
                </Text>
              </Pressable>

              <Pressable
                onPress={() => router.back()}
                className="py-3 items-center"
              >
                <Text className="text-white/50 text-base">Done</Text>
              </Pressable>
            </View>
          </GlassSheet>
        </View>
      )}
    </View>
  );
}
