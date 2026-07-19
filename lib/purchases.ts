import Purchases, {
  CustomerInfo,
  INTRO_ELIGIBILITY_STATUS,
  LOG_LEVEL,
  PurchasesOffering,
  PurchasesPackage,
} from 'react-native-purchases';
import { PRO } from '@/constants/config';
import { usePlanStore } from '@/stores/planStore';

const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
const isConfigured = !!apiKey && apiKey.startsWith('appl_');

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
    // TODO: refactor paywal for the case when user already user trial INTRO_ELIGIBILITY_STATUS_INELIGIBLE = 1,
    // return result[productId]?.status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE;
    return true;
  } catch {
    return false;
  }
}
