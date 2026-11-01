import Purchases, {
  CustomerInfo,
  INTRO_ELIGIBILITY_STATUS,
  LOG_LEVEL,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';
import { PRO } from '@/constants/config';
import { usePlanStore } from '@/stores/planStore';

const productionKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
// RevenueCat Test Store key (test_…): simulated purchases with no App Store
// Connect, works on the simulator via `expo run:ios`. Dev builds only — the
// __DEV__ guard keeps it out of release bundles, so it can never ship.
const testStoreKey = __DEV__ ? process.env.EXPO_PUBLIC_REVENUECAT_TEST_KEY : undefined;
const apiKey = testStoreKey?.startsWith('test_')
  ? testStoreKey
  : productionKey?.startsWith('appl_')
    ? productionKey
    : undefined;
const isConfigured = !!apiKey;

let initialized = false;

function syncFromCustomerInfo(info: CustomerInfo) {
  const active = !!info.entitlements.active[PRO.entitlementId];
  usePlanStore.getState().setPlan(active ? 'pro' : 'free');
}

/** Configure RevenueCat once at app start. No-ops when the env key is absent. */
export function initPurchases() {
  if (!isConfigured || initialized) return;
  initialized = true;

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }
  Purchases.configure({ apiKey: apiKey! });
  Purchases.addCustomerInfoUpdateListener(syncFromCustomerInfo);
  // Initial sync; offline errors are fine — the persisted plan stands until we hear otherwise
  refreshCustomerInfo();
}

/** Re-check entitlements (called on app foreground to catch expiry/renewal). */
export function refreshCustomerInfo() {
  if (!isConfigured || !initialized) return;
  Purchases.getCustomerInfo().then(syncFromCustomerInfo).catch(() => {});
}

/** Current offering, or null when unavailable (offline, ASC not set up, no key). */
export async function loadOfferings(): Promise<PurchasesOffering | null> {
  if (!isConfigured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current ?? null;
    if (__DEV__ && current) {
      // Surfaces dashboard misconfigurations (e.g. a package attached to the
      // wrong store product) that otherwise show up as "wrong price on a card"
      console.log(
        '[purchases] offering packages:',
        current.availablePackages
          .map((p) => `${p.identifier} → ${p.product.identifier} (${p.product.priceString})`)
          .join('; '),
      );
    }
    return current;
  } catch {
    return null;
  }
}

export type PurchaseResult = 'purchased' | 'cancelled' | 'failed';

/** Purchase a package. Entitlement sync happens via the customer-info listener. */
export async function purchase(pkg: PurchasesPackage): Promise<PurchaseResult> {
  if (!isConfigured) return 'failed';
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    syncFromCustomerInfo(customerInfo);
    return 'purchased';
  } catch (e) {
    if ((e as { userCancelled?: boolean }).userCancelled) return 'cancelled';
    return 'failed';
  }
}

/** Restore purchases. Returns true when the pro entitlement is now active. */
export async function restore(): Promise<boolean> {
  if (!isConfigured) return false;
  try {
    const info = await Purchases.restorePurchases();
    syncFromCustomerInfo(info);
    return !!info.entitlements.active[PRO.entitlementId];
  } catch {
    return false;
  }
}

/** True when the product's intro offer (3-day trial) is available to this user. */
export async function checkTrialEligibility(productId: string): Promise<boolean> {
  if (!isConfigured) return false;
  try {
    const result = await Purchases.checkTrialOrIntroductoryPriceEligibility([productId]);
    // Only ELIGIBLE promises a trial. INELIGIBLE (trial already used),
    // NO_INTRO_OFFER_EXISTS and UNKNOWN fall back to plain pricing copy —
    // advertising a trial Apple won't grant is an App Review rejection.
    return result[productId]?.status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE;
  } catch {
    return false;
  }
}
