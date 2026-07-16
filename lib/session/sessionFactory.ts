import type { AssetMeta, Category, Session } from '@/types';
import {
  getByYear,
  getByMonth,
  getOnThisDayByYear,
  getScreenshots,
  getVideos,
  getRandom,
} from '@/lib/gallery/grouper';
import { monthLabel } from '@/lib/dateUtils';
import { filterGroupsForReview } from '@/lib/similar/filterGroups';
import { GALLERY } from '@/constants/config';

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export interface SessionRequest {
  category: Category;
  // For year/month/on-this-day — which specific year or month key to review
  yearFilter?: number;
  monthFilter?: string; // 'YYYY-MM'
  batchSize?: number;
}

export function createSession(
  request: SessionRequest,
  index: AssetMeta[],
  keepIds: Set<string> = new Set(),
  similarGroups: string[][] = [],
): Session {
  const { category, yearFilter, monthFilter, batchSize = GALLERY.defaultBatchSize } = request;
  let assets: AssetMeta[] = [];
  let label = '';

  if (category === 'similar') {
    // Batch unit is GROUPS, not photos — a session reviews `batchSize` groups
    const indexIds = new Set(index.map((a) => a.id));
    const groups = filterGroupsForReview(similarGroups, keepIds, indexIds).slice(0, batchSize);
    return {
      id: randomId(),
      category,
      label: 'Similar Photos',
      assetIds: groups.flat(),
      createdAt: Date.now(),
      groups,
    };
  }

  switch (category) {
    case 'year': {
      const grouped = getByYear(index);
      const year = yearFilter ?? [...grouped.keys()][0];
      assets = grouped.get(year) ?? [];
      label = String(year);
      break;
    }
    case 'month': {
      const grouped = getByMonth(index);
      const key = monthFilter ?? [...grouped.keys()][0];
      assets = grouped.get(key) ?? [];
      label = monthLabel(key);
      break;
    }
    case 'on-this-day': {
      const today = new Date();
      const grouped = getOnThisDayByYear(index, today);
      if (yearFilter !== undefined) {
        // Reviewing a specific year's On This Day photos
        assets = grouped.get(yearFilter) ?? [];
        label = `${yearFilter} · On This Day`;
      } else {
        // All On This Day assets across all past years
        assets = Array.from(grouped.values()).flat();
        label = 'On This Day';
      }
      break;
    }
    case 'screenshots':
      assets = getScreenshots(index);
      label = 'Screenshots';
      break;
    case 'videos':
      assets = getVideos(index);
      label = 'Videos';
      break;
    case 'random':
      // For random: filter kept IDs before shuffle so the sample draws from un-kept only
      assets = getRandom(index.filter((a) => !keepIds.has(a.id)), batchSize);
      label = 'Random Review';
      break;
  }

  // For all non-random categories: exclude already-kept photos, then take one batch
  if (category !== 'random') {
    assets = assets.filter((a) => !keepIds.has(a.id)).slice(0, batchSize);
  }

  return {
    id: randomId(),
    category,
    label,
    assetIds: assets.map((a) => a.id),
    createdAt: Date.now(),
  };
}
