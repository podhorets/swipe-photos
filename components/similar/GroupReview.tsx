import React, { useEffect, useImperativeHandle, useMemo, useState } from 'react';
import Animated, {
  FadeIn,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { gatedHaptic } from '@/lib/haptics';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useSimilarStore } from '@/stores/similarStore';
import { enforceKeepBest } from '@/lib/similar/safetyRule';
import { GroupCard } from '@/components/similar/GroupCard';
import { SCREEN } from '@/constants/theme';
import type { SwipeDecision, SwipeDirection } from '@/types';

const EMPTY_SET: Set<string> = new Set();

export interface GroupReviewHandle {
  /** Fly the current group off: 'right' = accept (clean), 'left' = skip (keep all). */
  dismiss: (direction: SwipeDirection) => void;
}

interface GroupReviewProps {
  onSessionComplete: () => void;
  onPreview: (assetId: string) => void;
  /** Reports the current group's pending delete + kept counts for the action bar. */
  onPendingChange?: (deleteCount: number, keptCount: number) => void;
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
  const multiBest = useSettingsStore((s) => s.multiBest);

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

  // Per-group UI state, derived-with-override: the default best comes from the
  // scan (else last usable) and is correct on the FIRST render of every group —
  // an effect-based reset would paint one frame with the previous group's best
  // (stale hero photo). User picks live in `override`, valid only while the
  // group key matches.
  const [override, setOverride] = useState<{
    key: string;
    bestId: string;
    keeperIds: Set<string>;
  } | null>(null);

  const defaultBest =
    usableIds.find((id) => bestIdsFromScan.has(id)) ?? usableIds[usableIds.length - 1] ?? null;
  const hasOverride = override !== null && override.key === currentGroupKey;
  const bestId = hasOverride ? override.bestId : defaultBest;
  const keeperIds = hasOverride ? override.keeperIds : EMPTY_SET;

  const pendingDeleteCount =
    bestId && currentGroup
      ? usableIds.filter((id) => id !== bestId && !keeperIds.has(id)).length
      : 0;
  const keptCount = usableIds.length - pendingDeleteCount;
  useEffect(() => {
    onPendingChange?.(pendingDeleteCount, keptCount);
  }, [pendingDeleteCount, keptCount, onPendingChange]);

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

  // Buttons-only review: no pan gesture. The directional fly-off remains as
  // feedback (left = kept, right = cleaned) but is triggered via dismiss().
  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { rotate: `${interpolate(translateX.value, [-SCREEN.width, SCREEN.width], [-7, 7])}deg` },
    ],
  }));

  if (!session || !currentGroup || !bestId) return null;

  return (
    <Animated.View style={cardStyle}>
      <Animated.View key={currentGroupKey} entering={FadeIn.duration(160)}>
        <GroupCard
          groupIds={usableIds}
          bestId={bestId}
          keeperIds={keeperIds}
          multiBest={multiBest}
          uriById={uriById}
          sizeById={sizeById}
          onSelectBest={(id) => {
            if (!currentGroupKey || !bestId) return;
            if (multiBest) {
              // Multi mode: taps toggle stars. The hero follows the latest
              // starred photo; un-starring the last kept photo is blocked.
              const keepers = new Set(keeperIds);
              if (id === bestId) {
                const promoted = usableIds.find((k) => keepers.has(k));
                if (!promoted) return; // last star — a group can never lose all keeps
                keepers.delete(promoted);
                setOverride({ key: currentGroupKey, bestId: promoted, keeperIds: keepers });
              } else if (keepers.has(id)) {
                keepers.delete(id);
                setOverride({ key: currentGroupKey, bestId, keeperIds: keepers });
              } else {
                keepers.add(bestId);
                setOverride({ key: currentGroupKey, bestId: id, keeperIds: keepers });
              }
            } else {
              // Single mode: tap replaces the one best
              const keepers = new Set(keeperIds);
              keepers.delete(id); // best is always kept — drop redundant keeper mark
              setOverride({ key: currentGroupKey, bestId: id, keeperIds: keepers });
            }
            gatedHaptic(Haptics.ImpactFeedbackStyle.Light);
          }}
          onToggleKeeper={(id) => {
            if (!currentGroupKey || !bestId) return;
            const keepers = new Set(keeperIds);
            if (keepers.has(id)) keepers.delete(id);
            else keepers.add(id);
            setOverride({ key: currentGroupKey, bestId, keeperIds: keepers });
            gatedHaptic(Haptics.ImpactFeedbackStyle.Light);
          }}
          onPreview={onPreview}
        />
      </Animated.View>
    </Animated.View>
  );
}
