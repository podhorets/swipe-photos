import { useMemo } from 'react';
import { View, Text, Pressable, ScrollView, Modal } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GlassSheet } from '@/components/glass/GlassSheet';
import { useGalleryStore } from '@/stores/galleryStore';
import { getByYear, getByMonth } from '@/lib/gallery/grouper';
import { monthLabel } from '@/lib/dateUtils';

interface YearPickerProps {
  visible: boolean;
  onSelect: (year: number) => void;
  onClose: () => void;
}

interface MonthPickerProps {
  visible: boolean;
  onSelect: (yyyymm: string) => void;
  onClose: () => void;
}

// ─── Shared row component ─────────────────────────────────────────────────────

function PickerRow({
  label,
  count,
  onPress,
}: {
  label: string;
  count: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center py-4 border-b border-white/10 active:opacity-60"
    >
      <View className="flex-1">
        <Text className="text-white font-semibold text-base">{label}</Text>
        <Text className="text-white/40 text-sm mt-0.5">{count} photos</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
    </Pressable>
  );
}

// ─── Year Picker ──────────────────────────────────────────────────────────────

export function YearPicker({ visible, onSelect, onClose }: YearPickerProps) {
  const index = useGalleryStore((s) => s.index);

  const years = useMemo(() => {
    const byYear = getByYear(index);
    return Array.from(byYear.entries()).map(([year, assets]) => ({
      year,
      count: assets.length,
    }));
  }, [index]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/60">
        <Pressable className="flex-1" onPress={onClose} />
        <GlassSheet>
          <View className="flex-row items-center mb-2">
            <Text className="flex-1 text-white text-xl font-bold">Select Year</Text>
            <Pressable onPress={onClose} className="p-1">
              <Ionicons name="close-circle" size={24} color="rgba(255,255,255,0.4)" />
            </Pressable>
          </View>
          <ScrollView
            style={{ maxHeight: 400 }}
            showsVerticalScrollIndicator={false}
          >
            {years.map(({ year, count }) => (
              <PickerRow
                key={year}
                label={String(year)}
                count={count}
                onPress={() => onSelect(year)}
              />
            ))}
          </ScrollView>
        </GlassSheet>
      </View>
    </Modal>
  );
}

// ─── Month Picker ─────────────────────────────────────────────────────────────

export function MonthPicker({ visible, onSelect, onClose }: MonthPickerProps) {
  const index = useGalleryStore((s) => s.index);

  const months = useMemo(() => {
    const byMonth = getByMonth(index);
    return Array.from(byMonth.entries()).map(([yyyymm, assets]) => ({
      yyyymm,
      label: monthLabel(yyyymm),
      count: assets.length,
    }));
  }, [index]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end bg-black/60">
        <Pressable className="flex-1" onPress={onClose} />
        <GlassSheet>
          <View className="flex-row items-center mb-2">
            <Text className="flex-1 text-white text-xl font-bold">Select Month</Text>
            <Pressable onPress={onClose} className="p-1">
              <Ionicons name="close-circle" size={24} color="rgba(255,255,255,0.4)" />
            </Pressable>
          </View>
          <ScrollView
            style={{ maxHeight: 400 }}
            showsVerticalScrollIndicator={false}
          >
            {months.map(({ yyyymm, label, count }) => (
              <PickerRow
                key={yyyymm}
                label={label}
                count={count}
                onPress={() => onSelect(yyyymm)}
              />
            ))}
          </ScrollView>
        </GlassSheet>
      </View>
    </Modal>
  );
}
