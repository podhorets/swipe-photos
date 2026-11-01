import React, { useRef } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS, REVIEW_CARD } from '@/constants/theme';
import { formatBytes } from '@/lib/dateUtils';
import { ProgressivePhoto } from '@/components/similar/ProgressivePhoto';

export const GROUP_HERO_WIDTH = REVIEW_CARD.width;
export const GROUP_HERO_HEIGHT = REVIEW_CARD.height - 118; // room for the thumbnail rail
const THUMB_SIZE = 76;

interface GroupCardProps {
  groupIds: string[];
  /** Photo shown large — the last one tapped (the suggested best at first). */
  heroId: string;
  /** Starred photos are kept; the rest are deleted when the group is accepted. */
  starredIds: Set<string>;
  /** Multi mode: thumbnail taps toggle stars on any number of photos.
   *  One mode: taps move the single star (or remove it). */
  multiBest: boolean;
  uriById: Map<string, string>;
  sizeById: Map<string, number>;
  onToggleStar: (id: string) => void;
  onPreview: (id: string) => void;
}

/**
 * One duplicate group: hero preview of the last tapped photo plus a thumbnail
 * rail of all members. Everything not starred gets deleted when the group is
 * accepted; badges show each photo's fate.
 */
export function GroupCard({
  groupIds,
  heroId,
  starredIds,
  multiBest,
  uriById,
  sizeById,
  onToggleStar,
  onPreview,
}: GroupCardProps) {
  // The suggested best leads the rail. Order is frozen at group load (the
  // component remounts per group) — starring or unstarring moves only the
  // badges, never the thumbnails, so nothing jumps under the user's finger.
  const railIdsRef = useRef<string[] | null>(null);
  if (railIdsRef.current === null) {
    railIdsRef.current = [heroId, ...groupIds.filter((id) => id !== heroId)];
  }
  const railIds = railIdsRef.current;

  const deleteIds = groupIds.filter((id) => !starredIds.has(id));
  const freeBytes = deleteIds.reduce((sum, id) => sum + (sizeById.get(id) ?? 0), 0);
  const heroUri = uriById.get(heroId);
  const heroKept = starredIds.has(heroId);

  return (
    <View style={{ width: GROUP_HERO_WIDTH }}>
      {/* Hero — last tapped photo, dimmed when it's headed for deletion */}
      <View
        className={`rounded-3xl overflow-hidden bg-bg-card border ${
          heroKept ? 'border-white/10' : 'border-[rgba(255,69,58,0.45)]'
        }`}
        style={{ width: GROUP_HERO_WIDTH, height: GROUP_HERO_HEIGHT }}
      >
        {heroUri && (
          <Pressable onPress={() => onPreview(heroId)} accessibilityLabel="Preview photo">
            <ProgressivePhoto uri={heroUri} width={GROUP_HERO_WIDTH} height={GROUP_HERO_HEIGHT} />
          </Pressable>
        )}
        {!heroKept && <View className="absolute inset-0 bg-black/35" pointerEvents="none" />}

        {/* Fate badge — the hero's star state, in words */}
        <View className="absolute top-3 left-3 flex-row items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/55">
          <Ionicons
            name={heroKept ? 'star' : 'trash-outline'}
            size={12}
            color={heroKept ? '#FFD60A' : COLORS.destructive}
          />
          <Text className="text-white text-[12px] font-bold">{heroKept ? 'Keep' : 'Delete'}</Text>
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

      {/* Thumbnail rail — suggested best first; tap = star or unstar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mt-3"
        contentContainerClassName="gap-2.5 px-0.5"
      >
        {railIds.map((id) => {
          const uri = uriById.get(id);
          const isKept = starredIds.has(id);
          const willDelete = !isKept;
          return (
            <Pressable
              key={id}
              onPress={() => onToggleStar(id)}
              accessibilityLabel={
                isKept
                  ? 'Starred to keep — tap to delete instead'
                  : multiBest
                    ? 'Marked for deletion — tap to star and keep'
                    : 'Marked for deletion — tap to keep this one instead'
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

              {/* Every kept photo carries a star — at most one in One mode,
                  any number in Multi mode, or none (the whole group goes).
                  No other selection states exist. */}
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
