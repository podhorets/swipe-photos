import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as MediaLibrary from 'expo-media-library';
import * as LocalAuthentication from 'expo-local-authentication';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSessionStore } from '@/stores/sessionStore';
import { useKeepStore } from '@/stores/keepStore';
import { useGalleryStore } from '@/stores/galleryStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useStreakStore } from '@/stores/streakStore';
import { useStatsStore } from '@/stores/statsStore';
import { SessionCompleteSheet } from '@/components/ui/SessionCompleteSheet';
import { AuroraBackground } from '@/components/glass/AuroraBackground';
import { GradientPillButton } from '@/components/ui/GradientPillButton';
import { estimateSizeFromAsset } from '@/lib/sizeUtils';
import { formatBytes } from '@/lib/dateUtils';
import type { AssetMeta } from '@/types';
import { posthog } from '@/lib/posthog';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_GAP = 8;
const CELL_SIZE = (SCREEN_WIDTH - 40 - GRID_GAP * 2) / 3; // px-5 screen padding, 3 cols

// ─── Photo cell ───────────────────────────────────────────────────────────────

function PhotoCell({
  asset,
  selected,
  onToggle,
}: {
  asset: AssetMeta;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <Pressable
      onPress={() => onToggle(asset.id)}
      className="rounded-2xl overflow-hidden"
      style={{
        width: CELL_SIZE,
        height: CELL_SIZE,
        borderWidth: selected ? 2 : 0,
        borderColor: 'rgba(255,69,58,0.85)',
      }}
    >
      <Image
        source={{ uri: asset.uri }}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        recyclingKey={asset.id}
      />
      {/* Deselected — kept overlay */}
      {!selected && (
        <View className="absolute inset-0 bg-[rgba(5,5,8,0.68)] items-center justify-center">
          <View className="flex-row items-center gap-1 px-[9px] py-1 rounded-full bg-[rgba(48,209,88,0.2)] border border-[rgba(48,209,88,0.5)]">
            <Ionicons name="heart" size={10} color="#30D158" />
            <Text className="text-keep text-[10px] font-bold">Kept</Text>
          </View>
        </View>
      )}
      {/* Selected — red check badge */}
      {selected && (
        <View
          className="absolute top-1.5 right-1.5 w-[22px] h-[22px] rounded-full bg-delete items-center justify-center"
          style={{
            shadowColor: '#000',
            shadowOpacity: 0.4,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
          }}
        >
          <Ionicons name="checkmark" size={13} color="white" />
        </View>
      )}
      {/* Video badge */}
      {asset.mediaType === 'video' && (
        <View className="absolute bottom-1 left-1 bg-black/60 rounded px-1 py-0.5 flex-row items-center gap-0.5">
          <Ionicons name="play" size={9} color="white" />
        </View>
      )}
    </Pressable>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyTrash() {
  return (
    <View className="flex-1 items-center justify-center gap-3">
      <Ionicons name="trash-outline" size={56} color="rgba(255,255,255,0.15)" />
      <Text className="text-white/30 text-base">No photos marked for deletion</Text>
      <Pressable onPress={() => router.back()} className="mt-2">
        <Text className="text-white/50 text-sm">Go back</Text>
      </Pressable>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TrashScreen() {
  const insets = useSafeAreaInsets();

  const index = useGalleryStore((s) => s.index);
  const removeAssets = useGalleryStore((s) => s.removeAssets);
  const faceIdEnabled = useSettingsStore((s) => s.faceIdEnabled);

  const [isDeleting, setIsDeleting] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryStats, setSummaryStats] = useState({ total: 0, kept: 0, freedBytes: 0 });

  // Get delete decisions from the current session (session-scoped trash).
  // Captured once on mount — session decisions don't change while we're in trash.
  const [sessionDecisions] = useState(() => useSessionStore.getState().decisions);
  const [sessionSizeSnapshot] = useState(() => useSessionStore.getState().sizeSnapshot);
  const deleteIds = useMemo(
    () => Object.entries(sessionDecisions)
      .filter(([, d]) => d === 'delete')
      .map(([id]) => id),
    [sessionDecisions],
  );

  // Resolve delete IDs → AssetMeta (skip any no longer in index)
  const deleteAssets = useMemo(() => {
    const byId = new Map<string, AssetMeta>(index.map((a) => [a.id, a]));
    return deleteIds
      .map((id) => byId.get(id))
      .filter((a): a is AssetMeta => a !== undefined);
  }, [deleteIds, index]);

  // All delete assets are selected by default
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(deleteIds),
  );

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const allSelected = selected.size === deleteAssets.length;

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(deleteAssets.map((a) => a.id)));
    }
  }

  // Estimated bytes freed by the current selection — same math as handleDelete
  const selectedBytes = useMemo(() => {
    let sum = 0;
    for (const id of selected) {
      const real = sessionSizeSnapshot.get(id);
      const asset = deleteAssets.find((a) => a.id === id);
      sum += real ?? (asset ? estimateSizeFromAsset(asset) : 0);
    }
    return sum;
  }, [selected, deleteAssets, sessionSizeSnapshot]);

  async function handleDelete() {
    const idsToDelete = Array.from(selected);
    if (idsToDelete.length === 0) return;

    // Face ID gate
    if (faceIdEnabled) {
      const supported = await LocalAuthentication.hasHardwareAsync();
      if (supported) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: `Delete ${idsToDelete.length} photo${idsToDelete.length === 1 ? '' : 's'}`,
          fallbackLabel: 'Use Passcode',
          cancelLabel: 'Cancel',
        });
        if (!result.success) return;
      }
    }

    setIsDeleting(true);
    try {
      // deleteAssetsAsync shows a native iOS "Delete X Photos?" confirmation dialog
      await MediaLibrary.deleteAssetsAsync(idsToDelete);
    } catch {
      // Asset was already deleted externally — fall through to clean up
    } finally {
      // Remove deleted assets from gallery index
      removeAssets(idsToDelete);

      // IDs that were deselected (user changed mind) + all 'keep' decisions from session
      const deselectedIds = deleteIds.filter((id) => !selected.has(id));
      const sessionKeepIds = Object.entries(sessionDecisions)
        .filter(([, d]) => d === 'keep')
        .map(([id]) => id);
      const allKeptIds = [...deselectedIds, ...sessionKeepIds];
      if (allKeptIds.length > 0) {
        useKeepStore.getState().addMany(allKeptIds);
      }

      setIsDeleting(false);

      useStreakStore.getState().recordSession();

      const freedBytes = idsToDelete.reduce((sum, id) => {
        const real = sessionSizeSnapshot.get(id);
        const asset = deleteAssets.find(a => a.id === id);
        return sum + (real ?? (asset ? estimateSizeFromAsset(asset) : 0));
      }, 0);

      useStatsStore.getState().addFreedBytes(freedBytes);
      useStatsStore.getState().addDeletedCount(idsToDelete.length);

      posthog.capture('photos_deleted', {
        deleted_count: idsToDelete.length,
        kept_count: allKeptIds.length,
        freed_bytes: freedBytes,
        face_id_used: faceIdEnabled,
      });

      // Show inline summary
      setSummaryStats({
        total: Object.keys(sessionDecisions).length,
        kept: allKeptIds.length,
        freedBytes,
      });
      setShowSummary(true);
    }
  }

  if (deleteAssets.length === 0 && !showSummary) {
    return (
      <View className="flex-1 bg-bg-dark" style={{ paddingTop: insets.top }}>
        <AuroraBackground variant="trash" />
        <View className="flex-row items-center px-5 py-4 gap-3">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 items-center justify-center rounded-full bg-white/[0.08] border border-white/[0.14]"
          >
            <Ionicons name="chevron-back" size={20} color="white" />
          </Pressable>
          <Text className="text-white text-2xl font-extrabold" style={{ letterSpacing: -0.5 }}>
            Trash
          </Text>
        </View>
        <EmptyTrash />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg-dark">
      <AuroraBackground variant="trash" />

      {/* Header */}
      <View
        className="flex-row items-center px-5 pb-3.5 gap-3"
        style={{ paddingTop: insets.top + 12 }}
      >
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="w-10 h-10 items-center justify-center rounded-full bg-white/[0.08] border border-white/[0.14]"
        >
          <Ionicons name="chevron-back" size={20} color="white" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-white text-2xl font-extrabold" style={{ letterSpacing: -0.5 }}>
            Trash
          </Text>
          <Text className="text-white/45 text-[13px] mt-px">
            Last check before deleting — tap to keep instead
          </Text>
        </View>
        <Pressable onPress={toggleSelectAll} className="active:opacity-60" hitSlop={8}>
          <Text className="text-accent text-sm font-semibold">
            {allSelected ? 'Deselect all' : 'Select all'}
          </Text>
        </Pressable>
      </View>

      {/* Photo grid */}
      <FlatList
        data={deleteAssets}
        keyExtractor={(item) => item.id}
        numColumns={3}
        renderItem={({ item }) => (
          <PhotoCell
            asset={item}
            selected={selected.has(item.id)}
            onToggle={toggleSelect}
          />
        )}
        columnWrapperStyle={{ gap: GRID_GAP, paddingHorizontal: 20 }}
        contentContainerStyle={{ gap: GRID_GAP, paddingBottom: insets.bottom + 140 }}
        showsVerticalScrollIndicator={false}
      />

      {/* Floating bottom bar over fade-out gradient */}
      <View className="absolute bottom-0 left-0 right-0">
        <LinearGradient
          colors={['transparent', 'rgba(5,5,8,0.9)']}
          locations={[0, 0.4]}
          style={{
            paddingTop: 16,
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 16,
          }}
        >
          <View
            className="rounded-3xl overflow-hidden"
            style={{
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.14)',
              borderTopColor: 'rgba(255,255,255,0.28)',
            }}
          >
            <BlurView intensity={60} tint="dark" className="bg-chrome">
              <View className="flex-row items-center px-4 py-3.5 gap-3.5">
                <View className="flex-1">
                  <Text className="text-white text-[15px] font-bold">
                    {selected.size} selected
                  </Text>
                  <Text className="text-white/45 text-xs mt-px">
                    {selected.size > 0
                      ? `~${formatBytes(selectedBytes)} will be freed`
                      : 'Tap photos to select'}
                  </Text>
                </View>
                <GradientPillButton
                  label="Delete"
                  variant="delete"
                  compact
                  icon={faceIdEnabled ? 'lock-closed' : undefined}
                  onPress={handleDelete}
                  disabled={selected.size === 0}
                  loading={isDeleting}
                />
              </View>
            </BlurView>
          </View>
        </LinearGradient>
      </View>

      {/* Post-deletion summary overlay */}
      {showSummary && (
        <SessionCompleteSheet
          totalCount={summaryStats.total}
          keptCount={summaryStats.kept}
          freedBytes={summaryStats.freedBytes}
          onDone={() => router.back()}
        />
      )}
    </View>
  );
}
