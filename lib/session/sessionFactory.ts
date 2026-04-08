import type { AssetMeta, Category, Session } from '@/types';
import {
  getByYear,
  getByMonth,
  getOnThisDayByYear,
  getScreenshots,
  getVideos,
  getFavorites,
  getRandom,
} from '@/lib/gallery/grouper';
import { monthLabel } from '@/lib/dateUtils';
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
  favoriteIds: Set<string>,
): Session {
  const { category, yearFilter, monthFilter, batchSize = GALLERY.defaultBatchSize } = request;
  let assets: AssetMeta[] = [];
  let label = '';

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
    case 'favorites':
      assets = getFavorites(index, favoriteIds);
      label = 'Favorites';
      break;
    case 'random':
      assets = getRandom(index, batchSize);
      label = 'Random Review';
      break;
  }

  return {
    id: randomId(),
    category,
    label,
    assetIds: assets.map((a) => a.id),
    createdAt: Date.now(),
  };
}
