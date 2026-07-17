import React, { useRef } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { REVIEW_CARD } from '@/constants/theme';
import { formatBytes } from '@/lib/dateUtils';
import { ProgressivePhoto } from '@/components/similar/ProgressivePhoto';

export const GROUP_HERO_WIDTH = REVIEW_CARD.width;
export const GROUP_HERO_HEIGHT = REVIEW_CARD.height - 118; // room for the thumbnail rail
const THUMB_SIZE = 76;

interface GroupCardProps {
  groupIds: string[];
  bestId: string;
  keeperIds: Set<string>;
  /** Multi mode: thumbnail taps toggle stars on any number of keepers.
   *  Single mode: taps replace the one best — everything else gets deleted. */
  multiBest: boolean;
  uriById: Map<string, string>;
  sizeById: Map<string, number>;
  onSelectBest: (id: string) => void;
  onPreview: (id: string) => void;
}

/**
 * One duplicate group: hero preview of the current best pick plus a thumbnail
 * rail of all members. Everything not marked keep gets deleted when the group
 * is accepted; badges show each photo's fate.
 */
export function GroupCard({
  groupIds,
  bestId,
  keeperIds,
  multiBest,
  uriById,
  sizeById,
  onSelectBest,
  onPreview,
}: GroupCardProps) {
  // The suggested best leads the rail. Order is frozen at group load (the
  // component remounts per group) — picking a different best moves only the
  // badges, never the thumbnails, so nothing jumps under the user's finger.
  const railIdsRef = useRef<string[] | null>(null);
  if (railIdsRef.current === null) {
    railIdsRef.current = [bestId, ...groupIds.filter((id) => id !== bestId)];
  }
  const railIds = railIdsRef.current;

  const deleteIds = groupIds.filter((id) => id !== bestId && !keeperIds.has(id));
  const freeBytes = deleteIds.reduce((sum, id) => sum + (sizeById.get(id) ?? 0), 0);
  const heroUri = uriById.get(bestId);

  return (
    <View style={{ width: GROUP_HERO_WIDTH }}>
      {/* Hero — current best pick */}
      <View
        className="rounded-3xl overflow-hidden bg-bg-card border border-white/10"
        style={{ width: GROUP_HERO_WIDTH, height: GROUP_HERO_HEIGHT }}
      >
        {heroUri && (
          <Pressable onPress={() => onPreview(bestId)} accessibilityLabel="Preview best photo">
            <ProgressivePhoto uri={heroUri} width={GROUP_HERO_WIDTH} height={GROUP_HERO_HEIGHT} />
          </Pressable>
        )}

        {/* Best badge */}
        <View className="absolute top-3 left-3 flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/55">
          <Ionicons name="star" size={12} color="#FFD60A" />
          <Text className="text-white text-[12px] font-bold">Best</Text>
        </View>

        {/* Info chips */}
        <View className="absolute bottom-3 left-3 right-3 flex-row gap-2">
          <View className="px-2.5 py-1.5 rounded-full bg-black/55">
            <Text className="text-white text-[12px] font-semibold">
              {groupIds.length} similar
            </Text>
          </View>
          {deleteIds.length > 0 && (
            <View className="px-2.5 py-1.5 rounded-full bg-black/55 flex-row items-center gap-1">
              <Ionicons name="trash-outline" size={11} color="#FF453A" />
              <Text className="text-white text-[12px] font-semibold">
                {deleteIds.length} · {formatBytes(freeBytes)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Thumbnail rail — suggested best first; tap = make best, circle = toggle keep */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-3"
        contentContainerClassName="gap-2.5 px-0.5"
      >
        {railIds.map((id) => {
          const uri = uriById.get(id);
          const isBest = id === bestId;
          const isKept = isBest || keeperIds.has(id);
          const willDelete = !isKept;
          return (
            <Pressable
              key={id}
              onPress={() => onSelectBest(id)}
              accessibilityLabel={
                multiBest
                  ? isKept
                    ? 'Starred — tap to delete instead'
                    : 'Marked for deletion — tap to star and keep'
                  : isBest
                    ? 'Best photo'
                    : 'Make this the best photo'
              }
              className={
                isKept
                  ? 'rounded-2xl overflow-hidden border-2 border-[#FFD60A]'
                  : 'rounded-2xl overflow-hidden border-2 border-[rgba(255,69,58,0.45)]'
              }
              style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
            >
              {uri ? (
                <Image
                  source={{ uri }}
                  style={{ width: THUMB_SIZE, height: THUMB_SIZE, opacity: willDelete ? 0.55 : 1 }}
                  contentFit="cover"
                />
              ) : (
                <View className="flex-1 bg-white/10 items-center justify-center">
                  <Ionicons name="cloud-offline-outline" size={18} color="rgba(255,255,255,0.4)" />
                </View>
              )}

              {/* Fate marker: photos not kept show where they're headed */}
              {willDelete && (
                <View
                  className="absolute bottom-1 left-1 w-5 h-5 rounded-full bg-black/60 items-center justify-center"
                  pointerEvents="none"
                >
                  <Ionicons name="trash-outline" size={11} color="#FF453A" />
                </View>
              )}

              {/* Every kept photo carries a star — one in single mode, any
                  number in multi mode. No other selection states exist. */}
              {isKept && (
                <View className="absolute top-1 right-1 w-5 h-5 rounded-full bg-[#FFD60A] items-center justify-center">
                  <Ionicons name="star" size={11} color="black" />
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
