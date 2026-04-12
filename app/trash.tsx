import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import * as LocalAuthentication from 'expo-local-authentication';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSessionStore } from '@/stores/sessionStore';
import { useKeepStore } from '@/stores/keepStore';
import { useGalleryStore } from '@/stores/galleryStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { SessionCompleteSheet } from '@/components/ui/SessionCompleteSheet';
import type { AssetMeta } from '@/types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_SIZE = (SCREEN_WIDTH - 4) / 3; // 3 columns, 2px gaps

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
      style={{ width: CELL_SIZE, height: CELL_SIZE, margin: 1 }}
    >
      <Image
        source={{ uri: asset.uri }}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        recyclingKey={asset.id}
      />
      {/* Selection overlay */}
      {!selected && (
        <View className="absolute inset-0 bg-black/60" />
      )}
      {/* Checkmark badge */}
      <View className="absolute top-1.5 right-1.5">
        {selected ? (
          <View className="w-6 h-6 rounded-full bg-red-500 items-center justify-center">
            <Ionicons name="checkmark" size={14} color="white" />
          </View>
        ) : (
          <View className="w-6 h-6 rounded-full border-2 border-white/60" />
        )}
      </View>
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
  const [summaryStats, setSummaryStats] = useState({ total: 0, kept: 0 });

  // Get delete decisions from the current session (session-scoped trash).
  // Captured once on mount — session decisions don't change while we're in trash.
  const [sessionDecisions] = useState(() => useSessionStore.getState().decisions);
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

      // Show inline summary
      setSummaryStats({
        total: Object.keys(sessionDecisions).length,
        kept: allKeptIds.length,
      });
      setShowSummary(true);
    }
  }

  if (deleteAssets.length === 0 && !showSummary) {
    return (
      <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
        <View className="flex-row items-center px-6 py-4">
          <Pressable
            onPress={() => router.back()}
            className="w-9 h-9 items-center justify-center rounded-full bg-white/10 mr-3"
          >
            <Ionicons name="chevron-back" size={20} color="white" />
          </Pressable>
          <Text className="text-white text-2xl font-bold">Trash</Text>
        </View>
        <EmptyTrash />
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
          <Ionicons name="chevron-back" size={20} color="white" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-white text-2xl font-bold">Review Trash</Text>
          <Text className="text-white/40 text-xs mt-0.5">
            {deleteAssets.length} photo{deleteAssets.length === 1 ? '' : 's'} marked for deletion
          </Text>
        </View>
        {/* Select all toggle */}
        <Pressable
          onPress={toggleSelectAll}
          className="px-3 py-1.5 rounded-full bg-white/10"
        >
          <Text className="text-white/70 text-sm">
            {allSelected ? 'Deselect All' : 'Select All'}
          </Text>
        </Pressable>
      </View>

      {/* Hint */}
      <Text className="text-white/30 text-xs text-center mb-2">
        Tap to deselect · {selected.size} selected for deletion
      </Text>

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
        contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      />

      {/* Delete button */}
      <View
        className="absolute bottom-0 left-0 right-0 px-6"
        style={{ paddingBottom: insets.bottom + 16 }}
      >
        <Pressable
          onPress={handleDelete}
          disabled={selected.size === 0 || isDeleting}
          className="rounded-2xl py-4 items-center justify-center"
          style={{ backgroundColor: selected.size === 0 ? 'rgba(255,59,48,0.3)' : 'rgba(255,59,48,0.85)' }}
        >
          {isDeleting ? (
            <ActivityIndicator color="white" />
          ) : (
            <View className="flex-row items-center gap-2">
              {faceIdEnabled && (
                <Ionicons name="lock-closed" size={16} color="white" />
              )}
              <Text className="text-white font-semibold text-base">
                {selected.size === 0
                  ? 'Select photos to delete'
                  : `Delete ${selected.size} Photo${selected.size === 1 ? '' : 's'}`}
              </Text>
            </View>
          )}
        </Pressable>
      </View>

      {/* Post-deletion summary overlay */}
      {showSummary && (
        <SessionCompleteSheet
          totalCount={summaryStats.total}
          keptCount={summaryStats.kept}
          onDone={() => router.back()}
        />
      )}
    </View>
  );
}
