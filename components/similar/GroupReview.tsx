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
import type { SwipeDecision } from '@/types';

const EMPTY_SET: Set<string> = new Set();

/** keepAll = skip the group; keepStarred = delete every photo not starred (all of them if none are). */
export type GroupOutcome = 'keepAll' | 'keepStarred';

export interface GroupReviewHandle {
  /** Fly the current group off and apply the outcome: keepAll exits left, keepStarred right. */
  resolve: (outcome: GroupOutcome) => void;
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

  // Per-group UI state, derived-with-override: by default the scan's best (else
  // the last usable photo) is starred and shown large, correct on the FIRST
  // render of every group — an effect-based reset would paint one frame with
  // the previous group's photo. User picks live in `override`, valid only
  // while the group key matches.
  const [override, setOverride] = useState<{
    key: string;
    heroId: string;
    starredIds: Set<string>;
  } | null>(null);

  const defaultBest =
    usableIds.find((id) => bestIdsFromScan.has(id)) ?? usableIds[usableIds.length - 1] ?? null;
  const hasOverride = override !== null && override.key === currentGroupKey;
  // Shown large: the last photo tapped, so its new state is visible
  const heroId = hasOverride ? override.heroId : defaultBest;
  // Starred = kept. Anything from none (the whole group is deleted) to all.
  const starredIds = useMemo(
    () => (hasOverride ? override.starredIds : defaultBest ? new Set([defaultBest]) : EMPTY_SET),
    [hasOverride, override, defaultBest],
  );

  // Switching Multi → One leaves at most one star (the hero's, if starred);
  // extra stars don't survive the mode change (and don't silently reappear)
  useEffect(() => {
    if (multiBest || starredIds.size <= 1 || !currentGroupKey || !heroId) return;
    const keep = starredIds.has(heroId) ? heroId : [...starredIds][0];
    setOverride({ key: currentGroupKey, heroId, starredIds: new Set([keep]) });
  }, [multiBest, starredIds, currentGroupKey, heroId]);

  const keptCount = usableIds.filter((id) => starredIds.has(id)).length;
  const pendingDeleteCount = usableIds.length - keptCount;
  useEffect(() => {
    onPendingChange?.(pendingDeleteCount, keptCount);
  }, [pendingDeleteCount, keptCount, onPendingChange]);

  // ── Group resolution ──────────────────────────────────────────────────────

  function resolveGroup(outcome: GroupOutcome) {
    if (!currentGroup) return;
    let map: Record<string, SwipeDecision> = {};
    if (outcome === 'keepAll') {
      // Skip — keep everything
      for (const id of currentGroup) map[id] = 'keep';
      gatedHaptic(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      // Keep the starred photos (+ unusable members, which were never shown),
      // delete the rest. No stars is the user's explicit choice to delete the
      // whole group, so the keep-best backstop only guards the starred case.
      for (const id of currentGroup) {
        map[id] = !uriById.has(id) || starredIds.has(id) ? 'keep' : 'delete';
      }
      if (starredIds.size > 0) map = enforceKeepBest(currentGroup, map, bestIdsFromScan);
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

  function completeDismiss(outcome: GroupOutcome) {
    resolveGroup(outcome);
    translateX.value = 0; // next group renders centered
  }

  function flyOff(outcome: GroupOutcome) {
    'worklet';
    const target = (outcome === 'keepAll' ? -1 : 1) * SCREEN.width * 1.2;
    translateX.value = withTiming(target, { duration: 220 }, (finished) => {
      if (finished) runOnJS(completeDismiss)(outcome);
    });
  }

  useImperativeHandle(ref, () => ({
    resolve: (outcome: GroupOutcome) => {
      if (!currentGroup || !heroId) return;
      flyOff(outcome);
    },
  }));

  // Buttons-only review: no pan gesture. The directional fly-off remains as
  // feedback (left = kept, right = cleaned) but is triggered via resolve().
  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { rotate: `${interpolate(translateX.value, [-SCREEN.width, SCREEN.width], [-7, 7])}deg` },
    ],
  }));

  if (!session || !currentGroup || !heroId) return null;

  return (
    <Animated.View style={cardStyle}>
      <Animated.View key={currentGroupKey} entering={FadeIn.duration(160)}>
        <GroupCard
          groupIds={usableIds}
          heroId={heroId}
          starredIds={starredIds}
          multiBest={multiBest}
          uriById={uriById}
          sizeById={sizeById}
          onToggleStar={(id) => {
            if (!currentGroupKey) return;
            const starred = new Set(starredIds);
            if (starred.has(id)) {
              // Any star can go, the last one too: no stars deletes the group
              starred.delete(id);
            } else {
              // One mode moves the single star; Multi mode adds another
              if (!multiBest) starred.clear();
              starred.add(id);
            }
            setOverride({ key: currentGroupKey, heroId: id, starredIds: starred });
            gatedHaptic(Haptics.ImpactFeedbackStyle.Light);
          }}
          onPreview={onPreview}
        />
      </Animated.View>
    </Animated.View>
  );
}
