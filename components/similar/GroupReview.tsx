import React, { useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { gatedHaptic } from '@/lib/haptics';
import { useSessionStore } from '@/stores/sessionStore';
import { useSimilarStore } from '@/stores/similarStore';
import { enforceKeepBest } from '@/lib/similar/safetyRule';
import { GroupCard, GROUP_HERO_WIDTH } from '@/components/similar/GroupCard';
import { SPRING, SWIPE, SCREEN } from '@/constants/theme';
import type { SwipeDecision, SwipeDirection } from '@/types';

export interface GroupReviewHandle {
  /** Fly the current group off: 'right' = accept (clean), 'left' = skip (keep all). */
  dismiss: (direction: SwipeDirection) => void;
}

interface GroupReviewProps {
  onSessionComplete: () => void;
  onPreview: (assetId: string) => void;
  /** Reports the current group's pending delete count for the action bar label. */
  onPendingChange?: (deleteCount: number) => void;
  ref?: React.Ref<GroupReviewHandle>;
}

/**
 * Group-by-group engine for 'similar' sessions. Mirrors SwipeStack's contract:
 * drives sessionStore (decideMany), fires onSessionComplete when every flat
 * assetId has a decision. Current group is derived from decisions, so
 * undoLastGroup naturally rewinds it.
 */
export function GroupReview({ onSessionComplete, onPreview, onPendingChange, ref }: GroupReviewProps) {
  const session = useSessionStore((s) => s.session);
  const decisions = useSessionStore((s) => s.decisions);
  const uriById = useSessionStore((s) => s.uriSnapshot);
  const sizeById = useSessionStore((s) => s.sizeSnapshot);
  const bestIdsFromScan = useSimilarStore((s) => s.bestIds);

  const groups = useMemo(() => session?.groups ?? [], [session?.id]);

  // First group with any undecided member — survives undo without local index state
  const currentGroup = useMemo(
    () => groups.find((g) => g.some((id) => !(id in decisions))) ?? null,
    [groups, decisions],
  );
  // Stable identity for per-group UI state reset
  const currentGroupKey = currentGroup?.[0] ?? null;

  // Members with usable URIs — the ones actually reviewable
  const usableIds = useMemo(
    () => currentGroup?.filter((id) => uriById.has(id)) ?? [],
    [currentGroupKey, uriById],
  );

  // Per-group UI state: suggested best (from scan, else last usable) + extra keepers
  const [bestId, setBestId] = useState<string | null>(null);
  const [keeperIds, setKeeperIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!currentGroupKey || usableIds.length === 0) return;
    const suggested = usableIds.find((id) => bestIdsFromScan.has(id)) ?? usableIds[usableIds.length - 1];
    setBestId(suggested);
    setKeeperIds(new Set());
  }, [currentGroupKey]);

  const pendingDeleteCount =
    bestId && currentGroup
      ? usableIds.filter((id) => id !== bestId && !keeperIds.has(id)).length
      : 0;
  useEffect(() => {
    onPendingChange?.(pendingDeleteCount);
  }, [pendingDeleteCount, onPendingChange]);

  // ── Group resolution ──────────────────────────────────────────────────────

  function resolveGroup(direction: SwipeDirection) {
    if (!currentGroup || !bestId) return;
    let map: Record<string, SwipeDecision> = {};
    if (direction === 'left') {
      // Skip — keep everything
      for (const id of currentGroup) map[id] = 'keep';
      gatedHaptic(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      // Accept — keep best + keepers (+ unusable members, defensively), delete the rest
      for (const id of currentGroup) {
        const usable = uriById.has(id);
        map[id] = !usable || id === bestId || keeperIds.has(id) ? 'keep' : 'delete';
      }
      map = enforceKeepBest(currentGroup, map, bestIdsFromScan);
      gatedHaptic(Haptics.ImpactFeedbackStyle.Heavy);
    }
    useSessionStore.getState().decideMany(map);
  }

  // Groups that can't be meaningfully reviewed (fewer than 2 usable members)
  // are auto-skipped so decisions always cover every flat assetId.
  useEffect(() => {
    if (!currentGroup || usableIds.length >= 2) return;
    const map: Record<string, SwipeDecision> = {};
    for (const id of currentGroup) map[id] = 'keep';
    useSessionStore.getState().decideMany(map);
  }, [currentGroupKey, usableIds.length]);

  // Completion: every flat assetId decided
  const totalCount = session?.assetIds.length ?? 0;
  const decidedCount = Object.keys(decisions).length;
  useEffect(() => {
    if (totalCount > 0 && decidedCount >= totalCount) onSessionComplete();
  }, [decidedCount, totalCount, onSessionComplete]);

  // ── Swipe gesture / fly-off ───────────────────────────────────────────────

  const translateX = useSharedValue(0);

  function completeDismiss(direction: SwipeDirection) {
    resolveGroup(direction);
    translateX.value = 0; // next group renders centered
  }

  function flyOff(direction: SwipeDirection) {
    'worklet';
    const target = (direction === 'right' ? 1 : -1) * SCREEN.width * 1.2;
    translateX.value = withTiming(target, { duration: 220 }, (finished) => {
      if (finished) runOnJS(completeDismiss)(direction);
    });
  }

  useImperativeHandle(ref, () => ({
    dismiss: (direction: SwipeDirection) => {
      if (!currentGroup || !bestId) return;
      flyOff(direction);
    },
  }));

  const pan = Gesture.Pan()
    .onChange((e) => {
      translateX.value += e.changeX;
    })
    .onEnd((e) => {
      const passedDistance = Math.abs(translateX.value) > SWIPE.thresholdPx;
      const passedVelocity =
        Math.abs(e.velocityX) > SWIPE.velocityThresholdX &&
        Math.abs(translateX.value) > SWIPE.thresholdPx / 2;
      if (passedDistance || passedVelocity) {
        flyOff(translateX.value > 0 ? 'right' : 'left');
      } else {
        translateX.value = withSpring(0, SPRING.snappy);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { rotate: `${interpolate(translateX.value, [-SCREEN.width, SCREEN.width], [-7, 7])}deg` },
    ],
  }));

  const acceptHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE.thresholdPx], [0, 1]),
  }));
  const skipHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE.thresholdPx, 0], [1, 0]),
  }));

  if (!session || !currentGroup || !bestId) return null;

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={cardStyle}>
        <Animated.View key={currentGroupKey} entering={FadeIn.duration(160)}>
          <GroupCard
            groupIds={usableIds}
            bestId={bestId}
            keeperIds={keeperIds}
            uriById={uriById}
            sizeById={sizeById}
            onSelectBest={(id) => {
              setBestId(id);
              setKeeperIds((prev) => {
                if (!prev.has(id)) return prev;
                const next = new Set(prev);
                next.delete(id);
                return next;
              });
              gatedHaptic(Haptics.ImpactFeedbackStyle.Light);
            }}
            onToggleKeeper={(id) => {
              setKeeperIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              });
              gatedHaptic(Haptics.ImpactFeedbackStyle.Light);
            }}
            onPreview={onPreview}
          />
        </Animated.View>

        {/* Swipe hints */}
        <Animated.View
          style={[acceptHintStyle, { position: 'absolute', top: 24, left: 20 }]}
          pointerEvents="none"
        >
          <View className="px-3.5 py-2 rounded-xl bg-accent/90 -rotate-6">
            <Text className="text-white font-extrabold text-lg" style={{ letterSpacing: 1 }}>
              CLEAN {pendingDeleteCount > 0 ? pendingDeleteCount : ''}
            </Text>
          </View>
        </Animated.View>
        <Animated.View
          style={[skipHintStyle, { position: 'absolute', top: 24, right: 20, alignItems: 'flex-end' }]}
          pointerEvents="none"
        >
          <View className="px-3.5 py-2 rounded-xl bg-keep/90 rotate-6">
            <Text className="text-white font-extrabold text-lg" style={{ letterSpacing: 1 }}>
              KEEP ALL
            </Text>
          </View>
        </Animated.View>

        {/* Constrain hint overlays to the card width */}
        <View style={{ width: GROUP_HERO_WIDTH, height: 0 }} />
      </Animated.View>
    </GestureDetector>
  );
}
