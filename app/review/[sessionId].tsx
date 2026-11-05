import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSession } from '@/hooks/useSession';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useKeepStore } from '@/stores/keepStore';
import { useFeedStore } from '@/stores/feedStore';
import { useStreakStore } from '@/stores/streakStore';
import { usePlanStore } from '@/stores/planStore';
import { SwipeStack, type SwipeStackHandle } from '@/components/swipe/SwipeStack';
import { GroupReview, type GroupReviewHandle } from '@/components/similar/GroupReview';
import { CircleButton } from '@/components/ui/CircleButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { SessionComplete } from '@/components/ui/SessionComplete';
import { SwipeActionButton } from '@/components/ui/SwipeActionButton';
import { REVIEW_CARD } from '@/constants/theme';
import { useTheme } from '@/lib/theme/ThemeProvider';
import type { Category } from '@/types';
import { posthog } from '@/lib/posthog';

// Must match SwipeCard/SwipeStack so the off-screen decode happens at the same size
// that SDWebImage will serve from its memory cache when the stack renders.
const PRELOAD_CARD_WIDTH = REVIEW_CARD.width;
const PRELOAD_CARD_HEIGHT = REVIEW_CARD.height;
const PRELOAD_TIMEOUT_MS = 2000;

/**
 * Outcome button for the group review bar. Titles lead with the OUTCOME
 * ("Keep All" / "Delete N") so neither needs decoding. Each wears its
 * outcome's ring; `highlighted` fades in the outcome's tint when the stars
 * make it the obvious choice (every photo starred → Keep All, none → Delete).
 */
function GroupActionButton({
  icon,
  title,
  subtitle,
  tone,
  highlighted,
  disabled = false,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  tone: 'keep' | 'delete';
  highlighted: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const glow = useSharedValue(highlighted ? 1 : 0);
  useEffect(() => {
    glow.value = withTiming(highlighted ? 1 : 0, { duration: 220 });
  }, [highlighted, glow]);
  const fillStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  const isKeep = tone === 'keep';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${title} — ${subtitle}`}
      className={`flex-1 min-h-[64px] rounded-full overflow-hidden border-2 bg-card active:opacity-80 ${
        isKeep ? 'border-keep-ring' : 'border-del-ring'
      }`}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <Animated.View
        className={`absolute inset-0 ${isKeep ? 'bg-keep-tint' : 'bg-del-tint'}`}
        style={fillStyle}
        pointerEvents="none"
      />
      <View className="flex-1 flex-row items-center gap-2 px-3 py-2">
        <Icon name={icon} size={22} color={isKeep ? t.keep.icon : t.remove.icon} />
        <View className="flex-1">
          <Text className="font-display text-fg text-[17px]" numberOfLines={1}>
            {title}
          </Text>
          <Text className="text-fg-2 text-[11px]" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function ReviewScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { sessionId, year, month, startGroup } = useLocalSearchParams<{
    sessionId: string;
    year?: string;
    month?: string;
    startGroup?: string;
  }>();

  const {
    session,
    progressFraction,
    remainingCount,
    totalCount,
    startSession,
    undoLast,
  } = useSession();

  // Imperative handle on SwipeStack — button path calls dismiss() so the top
  // card's fly-off spring fires identically to a gesture swipe.
  const swipeStackRef = useRef<SwipeStackHandle>(null);
  const groupReviewRef = useRef<GroupReviewHandle>(null);

  // 'similar' sessions review duplicate GROUPS with a different card + action bar
  const isSimilar = sessionId === 'similar';
  const [pendingCounts, setPendingCounts] = useState({ deleteCount: 0, keptCount: 0 });
  const multiBest = useSettingsStore((s) => s.multiBest);
  const setMultiBest = useSettingsStore((s) => s.setMultiBest);

  // Stable identity + reference-preserving set: GroupReview reports counts from
  // an effect keyed on this callback, so an inline closure (new identity each
  // render) setting a fresh object every call would loop the update cycle
  const handlePendingChange = useCallback((deleteCount: number, keptCount: number) => {
    setPendingCounts((prev) =>
      prev.deleteCount === deleteCount && prev.keptCount === keptCount
        ? prev
        : { deleteCount, keptCount },
    );
  }, []);

  // Read from the session URI snapshot — O(1) Map lookup, no gallery subscription.
  // This screen never touches galleryStore.index during an active session.
  const phase = useSessionStore((s) => s.phase);
  const uriById = useSessionStore((s) => s.uriSnapshot);
  // Group progress for similar sessions. Selects a number, not `decisions`, so a
  // regular swipe session doesn't re-render this whole screen on every decision.
  const resolvedGroups = useSessionStore((s) =>
    isSimilar && s.session?.groups
      ? s.session.groups.filter((g) => g.every((id) => id in s.decisions)).length
      : 0,
  );
  const totalGroups = isSimilar ? session?.groups?.length ?? 0 : 0;
  const groupsLeft = totalGroups - resolvedGroups;

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

  const sessionKey = `${sessionId}-${year ?? ''}-${month ?? ''}-${startGroup ?? ''}`;
  const lastStartedKey = useRef('');
  useEffect(() => {
    if (lastStartedKey.current === sessionKey) return;
    lastStartedKey.current = sessionKey;
    setShowComplete(false);
    // Story sessions (Feed POC) get their photos from the story the user tapped
    const story = sessionId === 'story' ? useFeedStore.getState().pendingStory : null;
    startSession({
      category: sessionId as Category,
      yearFilter: year ? Number(year) : undefined,
      monthFilter: month,
      startGroupKey: startGroup,
      storyIds: story?.ids,
      storyTitle: story?.title,
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
    if (isSimilar) groupReviewRef.current?.resolve('keepAll');
    else swipeStackRef.current?.dismiss('left');
  }

  function handleSwipeRight() {
    if (isSimilar) groupReviewRef.current?.resolve('keepStarred');
    else swipeStackRef.current?.dismiss('right');
  }

  function handleUndo() {
    undoOpacity.value = withTiming(0, { duration: 150 });
    if (isSimilar) useSessionStore.getState().undoLastGroup();
    else undoLast();
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
      usePlanStore.getState().recordCompletedSession();
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
            text: 'Review Trash',
            onPress: () => router.replace('/trash'),
          },
          {
            text: 'Discard & Close',
            style: 'destructive',
            onPress: () => router.back(),
          },
          // Accidental X tap — dismiss and keep swiping
          { text: 'Keep Reviewing', style: 'cancel' },
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
    // Param-object push: asset ids contain slashes (UUID/L0/001), so a
    // template-string URL would grow extra path segments and match no route
    router.push({ pathname: '/review/preview/[assetId]', params: { assetId } });
  }, []);

  // Counts for completion sheet (only computed when sheet is actually shown)
  const completionCounts = useMemo(() => {
    if (!showComplete) return { keptCount: 0 };
    const d = Object.values(useSessionStore.getState().decisions);
    return {
      keptCount: d.filter((v) => v === 'keep').length,
    };
  }, [showComplete]);

  // Nothing to review (e.g. a month whose photos were all kept already) — say
  // so instead of waiting on a stack that will never fill
  if (phase === 'active' && session && session.assetIds.length === 0) {
    return (
      <View className="flex-1 items-center justify-center">
        <ScreenBackground />
        <EmptyState
          icon="checkCircle"
          color="green"
          title="All caught up"
          body="There are no photos left to review here."
          action={{ label: 'Done', onPress: () => router.back() }}
        />
      </View>
    );
  }

  if (phase !== 'active' || !session || !sessionReady) {
    return (
      <View className="flex-1 items-center justify-center">
        <ScreenBackground />
        {/* Full-screen modal has no back gesture — never leave this state without an exit */}
        <View className="absolute left-[18px]" style={{ top: insets.top + 8 }}>
          <CircleButton icon="close" onPress={() => router.back()} accessibilityLabel="Close session" />
        </View>
        <Text className="text-fg-2">Loading session…</Text>
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
    <View className="flex-1">
      {/* Calm background only — nothing may glow or tint behind the photos */}
      <ScreenBackground />

      {/* Header */}
      <View className="flex-row items-center px-[18px] pb-2.5 gap-2" style={{ paddingTop: insets.top + 8 }}>
        <CircleButton icon="close" onPress={handleClose} accessibilityLabel="Close session" />

        <View className="flex-1" />

        {/* Title — absolutely centered so asymmetric side controls (mode
            toggle + undo on the right) can't push it off screen center */}
        <View
          className="absolute inset-x-0 items-center justify-center"
          style={{ top: insets.top + 8, height: 38 }}
          pointerEvents="none"
        >
          <Text className="font-display text-fg text-[17px]" numberOfLines={1}>
            {session.label}
          </Text>
          <Text className="text-fg-2 text-[12px]">
            {isSimilar
              ? `${groupsLeft} of ${totalGroups} groups left`
              : `${remainingCount} of ${totalCount} left`}
          </Text>
        </View>

        {/* Similar sessions: star-mode toggle — one best vs multiple keepers */}
        {isSimilar && (
          <Pressable
            onPress={() => setMultiBest(!multiBest)}
            accessibilityRole="button"
            accessibilityLabel={
              multiBest ? 'Multi-select mode — tap for single best mode' : 'Single best mode — tap for multi-select mode'
            }
            className="flex-row items-center gap-[5px] px-3 h-[38px] rounded-full bg-card border border-hairline active:opacity-70"
          >
            <Icon name="star" size={15} color={t.star} fill={multiBest ? t.star : undefined} />
            <Text className="text-fg text-[14px] font-bold">{multiBest ? 'Multi' : 'One'}</Text>
          </Pressable>
        )}

        {/* Undo — fades in after the first swipe */}
        <Animated.View style={undoAnimStyle} pointerEvents="box-none">
          <CircleButton icon="undo" onPress={handleUndo} accessibilityLabel="Undo last swipe" />
        </Animated.View>
      </View>

      {/* Progress bar */}
      <ProgressBar progress={progressFraction} thin className="mx-[18px]" />

      {/* Swipe stack / group review */}
      <View className="flex-1 items-center justify-center mt-3.5">
        {isSimilar ? (
          <GroupReview
            ref={groupReviewRef}
            onPreview={handleDoubleTap}
            onSessionComplete={handleSessionComplete}
            onPendingChange={handlePendingChange}
          />
        ) : (
          <SwipeStack
            ref={swipeStackRef}
            onDoubleTap={handleDoubleTap}
            onSessionComplete={handleSessionComplete}
          />
        )}
      </View>

      {/* Action bar — similar sessions resolve each group with two explicit
          outcome buttons (no swipe gestures here). Starring every photo lights
          up Keep All; unstarring every photo lights up Delete. */}
      {isSimilar ? (
        <View
          className="flex-row items-stretch justify-center gap-3 px-[18px]"
          style={{ paddingBottom: insets.bottom + 24 }}
        >
          <GroupActionButton
            icon="checkCircle"
            tone="keep"
            title="Keep All"
            subtitle="Nothing gets deleted"
            highlighted={pendingCounts.deleteCount === 0 && pendingCounts.keptCount > 0}
            onPress={handleSwipeLeft}
          />
          <GroupActionButton
            icon="trash"
            tone="delete"
            title={pendingCounts.deleteCount > 0 ? `Delete ${pendingCounts.deleteCount}` : 'Delete'}
            subtitle={
              pendingCounts.keptCount === 0
                ? 'Nothing kept'
                : `Keeps ${pendingCounts.keptCount} starred`
            }
            highlighted={pendingCounts.keptCount === 0 && pendingCounts.deleteCount > 0}
            disabled={pendingCounts.deleteCount === 0}
            onPress={handleSwipeRight}
          />
        </View>
      ) : (
        <View
          className="flex-row items-center justify-between px-14"
          style={{ paddingBottom: insets.bottom + 18 }}
        >
          <SwipeActionButton type="delete" onPress={handleSwipeLeft} />
          <Text className="text-fg-2 text-[12px] font-bold">Swipe or tap</Text>
          <SwipeActionButton type="keep" onPress={handleSwipeRight} />
        </View>
      )}

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
