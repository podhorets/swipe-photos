import { PaywallHero } from '@/components/paywall/PaywallHero';
import { Card } from '@/components/ui/Card';
import { CircleButton } from '@/components/ui/CircleButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { ScreenBackground } from '@/components/ui/ScreenBackground';
import { FREE_PLAN, LEGAL } from '@/constants/config';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { posthog } from '@/lib/posthog';
import { isPro, sessionsRemaining } from '@/lib/planUtils';
import {
  checkTrialEligibility,
  loadOfferings,
  manageSubscriptions,
  purchase,
  restore,
} from '@/lib/purchases';
import { usePlanStore } from '@/stores/planStore';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type PlanId = 'annual' | 'weekly';
type PaywallContext = 'sessions' | 'batch' | 'chip' | 'settings';

const SUBSCRIPTION_NAME = 'Swipe Photos Pro';

// Every benefit here must be true of the code (lib/planUtils.ts) — a paywall
// that promises features the app doesn't have fails Guideline 2.3.1.
const BENEFITS: { icon: IconName; text: string }[] = [
  { icon: 'infinity', text: `Unlimited reviews every day (free: ${FREE_PLAN.sessionsPerDay} a day)` },
  { icon: 'feed', text: `Review up to 100 photos at a time (free: ${FREE_PLAN.maxBatchSize})` },
];

function headline(context: PaywallContext): string {
  switch (context) {
    case 'sessions':
      return "You're on a roll.\nDon't stop now.";
    case 'batch':
      return 'Clear 100 photos\nin one sitting';
    case 'chip':
      return 'Clean your library\nwithout limits';
    default:
      return 'Clear your backlog\nwith Pro';
  }
}

function formatPrice(amount: number, currencyCode: string): string | null {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(amount);
  } catch {
    return null;
  }
}

/** Weekly-equivalent of the yearly price, e.g. "$0.58" — computed from the store price. */
function perWeekPrice(pkg: PurchasesPackage | null): string | null {
  if (!pkg) return null;
  return formatPrice(pkg.product.price / 52, pkg.product.currencyCode);
}

/** Yearly savings vs 52 weekly payments, from real store prices (null if not a saving). */
function yearlySavingsPercent(weekly: PurchasesPackage | null, annual: PurchasesPackage | null): number | null {
  if (!weekly || !annual || weekly.product.currencyCode !== annual.product.currencyCode) return null;
  const pct = Math.floor((1 - annual.product.price / (weekly.product.price * 52)) * 100);
  return pct > 0 ? pct : null;
}

/** Free-trial length from the product's intro offer, e.g. "3-day" — null when there is no free trial. */
function freeTrialLabel(pkg: PurchasesPackage | null): { short: string; days: number | null } | null {
  const intro = pkg?.product.introPrice;
  if (!intro || intro.price !== 0) return null;
  const n = intro.periodNumberOfUnits;
  switch (intro.periodUnit) {
    case 'DAY':
      return { short: `${n}-day`, days: n };
    case 'WEEK':
      return { short: n === 1 ? '1-week' : `${n}-week`, days: n * 7 };
    case 'MONTH':
      return { short: n === 1 ? '1-month' : `${n}-month`, days: null };
    default:
      return null;
  }
}

function Benefits() {
  const t = useTheme();
  return (
    <Card className="px-3.5 py-3 gap-2.5 mb-4">
      <Text className="text-fg text-[14.5px] font-bold">{SUBSCRIPTION_NAME} includes</Text>
      {BENEFITS.map((b) => (
        <View key={b.text} className="flex-row items-center gap-2.5">
          <View className="w-[27px] h-[27px] rounded-full bg-tint items-center justify-center">
            <Icon name={b.icon} size={15} color={t.accent.primary} strokeWidth={2.2} />
          </View>
          <Text className="flex-1 text-fg text-[13.5px]">{b.text}</Text>
        </View>
      ))}
    </Card>
  );
}

function TrialTimeline({ days, renewalPrice }: { days: number | null; renewalPrice: string }) {
  const t = useTheme();
  const steps: { icon: IconName; title: string; sub: string }[] = [
    { icon: 'lockOpen', title: 'Today: Pro unlocks', sub: 'Free for the length of your trial.' },
    {
      icon: 'calendar',
      title: days ? `Day ${days}: trial ends` : 'Trial ends',
      sub: `You'll be charged ${renewalPrice} per week unless you cancel at least 24 hours before the trial ends.`,
    },
    {
      icon: 'closeCircle',
      title: 'Cancel anytime',
      sub: 'In Settings › your name › Subscriptions.',
    },
  ];
  return (
    <Card className="p-3.5 mb-4">
      {steps.map((s, i) => (
        <View key={s.title} className="flex-row gap-3">
          <View className="items-center">
            <View className="w-[27px] h-[27px] rounded-full bg-tint items-center justify-center">
              <Icon name={s.icon} size={15} color={t.accent.primary} strokeWidth={2.2} />
            </View>
            {i < steps.length - 1 && <View className="w-0.5 flex-1 bg-divider my-1" />}
          </View>
          <View className={i < steps.length - 1 ? 'flex-1 pb-4' : 'flex-1'}>
            <Text className="text-fg text-[15px] font-semibold">{s.title}</Text>
            <Text className="text-fg-2 text-[13px] mt-0.5">{s.sub}</Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

interface PlanCardProps {
  selected: boolean;
  onPress: () => void;
  title: string;
  price: string;
  priceSuffix: string;
  sub?: string | null;
  badge?: string | null;
}

function PlanCard({ selected, onPress, title, price, priceSuffix, sub, badge }: PlanCardProps) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}, ${price} ${priceSuffix}${sub ? `, ${sub}` : ''}`}
    >
      <View
        className={`rounded-[22px] bg-card px-3.5 py-3 justify-center ${
          selected ? 'border-2 border-accent min-h-[74px]' : 'border border-hairline min-h-[60px]'
        }`}
        style={{ boxShadow: t.shadow.card }}
      >
        {badge && (
          <View className="absolute -top-[9px] right-3.5 rounded-[9px] bg-badge px-[9px] py-0.5">
            <Text className="text-badge-fg text-[10.5px] font-extrabold" style={{ letterSpacing: 0.2 }}>
              {badge}
            </Text>
          </View>
        )}
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-row items-center gap-3 flex-1">
            {selected ? (
              <View className="w-[18px] h-[18px] rounded-full bg-accent items-center justify-center">
                <Icon name="check" size={10} color={t.text.onButton} strokeWidth={3.6} />
              </View>
            ) : (
              <View className="w-[17px] h-[17px] rounded-full border-[1.5px] border-fg-3" />
            )}
            <View className="flex-1">
              <Text className="text-fg text-[15.5px] font-bold">{title}</Text>
              {!!sub && <Text className="text-fg-2 text-[11.5px] mt-px">{sub}</Text>}
            </View>
          </View>
          {/* Billed amount is the most prominent number on the card */}
          <View className="items-end">
            <Text className="text-fg text-[17.5px] font-extrabold">{price}</Text>
            <Text className="text-fg-2 text-[11.5px]">{priceSuffix}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function FooterLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      className="min-h-[44px] px-[7px] items-center justify-center active:opacity-60"
    >
      <Text className="text-fg text-[12px] font-medium underline">{label}</Text>
    </Pressable>
  );
}

export default function PaywallScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ context?: string }>();
  const context = (params.context ?? 'settings') as PaywallContext;

  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [offeringsLoaded, setOfferingsLoaded] = useState(false);
  const [trialEligible, setTrialEligible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('weekly');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  // Pro users can still land here via the /paywall deep link — never sell them
  // a second subscription, point them at subscription management instead
  const pro = usePlanStore((s) => isPro(s));

  const fetchOfferings = useCallback(() => {
    setOfferingsLoaded(false);
    loadOfferings().then((o) => {
      setOffering(o);
      setOfferingsLoaded(true);
      const weeklyId = o?.weekly?.product.identifier;
      if (weeklyId) checkTrialEligibility(weeklyId).then(setTrialEligible);
    });
  }, []);

  useEffect(() => {
    posthog.capture('paywall_shown', { context });
    fetchOfferings();
  }, [context, fetchOfferings]);

  const weeklyPkg = offering?.weekly ?? null;
  const annualPkg = offering?.annual ?? null;
  const purchasesAvailable = !!(weeklyPkg && annualPkg);
  // Real store prices only — never show made-up fallback prices
  const weeklyPrice = weeklyPkg?.product.priceString ?? '';
  const annualPrice = annualPkg?.product.priceString ?? '';

  const savings = yearlySavingsPercent(weeklyPkg, annualPkg);
  const trial = freeTrialLabel(weeklyPkg);
  const showTrial = !pro && selectedPlan === 'weekly' && trialEligible && !!trial;

  // Lock chip only when the daily quota actually ran out (sessionGate opens the
  // paywall with context 'sessions'). Opened from Settings, the batch picker, or
  // the chip, the user may still have reviews left — claiming otherwise is false.
  const lockLabel = useMemo(() => {
    if (context !== 'sessions') return undefined;
    if (sessionsRemaining(usePlanStore.getState()) > 0) return undefined;
    return `${FREE_PLAN.sessionsPerDay} of ${FREE_PLAN.sessionsPerDay} free reviews used today`;
  }, [context]);

  function close() {
    posthog.capture('paywall_dismissed', { context });
    router.back();
  }

  async function handlePurchase() {
    if (!purchasesAvailable) return;
    const pkg = selectedPlan === 'annual' ? annualPkg! : weeklyPkg!;
    setPurchasing(true);
    posthog.capture('purchase_started', { package: pkg.identifier, context });
    const result = await purchase(pkg);
    setPurchasing(false);
    if (result === 'purchased') {
      posthog.capture('purchase_completed', { package: pkg.identifier, context });
      if (showTrial) posthog.capture('trial_started');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } else if (result === 'failed') {
      posthog.capture('purchase_failed', { package: pkg.identifier, context });
      Alert.alert('Purchase Failed', 'Something went wrong. You have not been charged.');
    }
    // 'cancelled': user closed the Apple sheet — stay quiet, stay on the paywall
  }

  async function handleRestore() {
    setRestoring(true);
    const restored = await restore();
    setRestoring(false);
    posthog.capture('restore_completed', { restored });
    if (restored) {
      Alert.alert('Purchases Restored', `${SUBSCRIPTION_NAME} is active again.`);
      router.back();
    } else {
      Alert.alert('Nothing to Restore', 'No active subscription was found for this Apple ID.');
    }
  }

  // Neutral CTA: Apple rejects paywalls that promote the free trial more
  // conspicuously than the billed amount (3.1.2) — the trial is described in
  // the plan card, the timeline and the disclosure instead.
  const ctaLabel = pro ? 'Manage Subscription' : 'Continue';

  // Auto-renewal disclosure (Guideline 3.1.2): price, period, trial, renewal and
  // cancellation terms, directly under the purchase button.
  const disclosure = pro
    ? `${SUBSCRIPTION_NAME} is active on this Apple ID.`
    : !purchasesAvailable
      ? ''
      : showTrial
        ? `Free for ${trial!.short.replace('-', ' ')}s, then ${weeklyPrice} per week. Payment is charged to your Apple ID when the trial ends. The subscription renews automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel anytime in your App Store account settings.`
        : `${selectedPlan === 'annual' ? `${annualPrice} per year` : `${weeklyPrice} per week`}, charged to your Apple ID at confirmation of purchase. The subscription renews automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel anytime in your App Store account settings.`;

  return (
    <View className="flex-1" style={{ paddingTop: insets.top }}>
      <ScreenBackground />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-[21px] pt-10"
        showsVerticalScrollIndicator={false}
      >
        {/* Living hero: lock chip (sessions) + auto-swiping demo */}
        <PaywallHero lockLabel={lockLabel} />

        {/* Headline + subscription name */}
        <View className="items-center mt-2 mb-5 gap-2.5">
          <Text className="font-display text-fg text-center text-[29px] leading-[32.5px]">{headline(context)}</Text>
          <Text className="text-fg-2 text-[13px]">{SUBSCRIPTION_NAME} · auto-renewable subscription</Text>
        </View>

        {/* Plan cards — or a clear error with retry when the store is unreachable */}
        {!offeringsLoaded ? (
          <View className="h-[150px] items-center justify-center mb-4">
            <ActivityIndicator color={t.accent.primary} />
          </View>
        ) : purchasesAvailable ? (
          <View className="gap-2.5 mb-4">
            <PlanCard
              selected={selectedPlan === 'annual'}
              onPress={() => setSelectedPlan('annual')}
              title="Yearly"
              price={annualPrice}
              priceSuffix="per year"
              sub={perWeekPrice(annualPkg) ? `${perWeekPrice(annualPkg)} per week, billed yearly` : null}
              badge={savings ? `BEST VALUE · SAVE ${savings}%` : null}
            />
            <PlanCard
              selected={selectedPlan === 'weekly'}
              onPress={() => setSelectedPlan('weekly')}
              title="Weekly"
              price={weeklyPrice}
              priceSuffix="per week"
              sub={trialEligible && trial ? `${trial.short} free trial, then ${weeklyPrice} per week` : 'Billed weekly'}
            />
          </View>
        ) : (
          !pro && (
            <Card className="py-6 mb-4">
              <EmptyState
                icon="cloudOffline"
                color="sky"
                title="Subscription options couldn’t be loaded"
                body="Check your internet connection and try again."
                action={{ label: 'Try Again', onPress: fetchOfferings }}
              />
            </Card>
          )
        )}

        <Benefits />

        {/* Trial timeline (weekly + eligible free trial only) */}
        {showTrial && <TrialTimeline days={trial!.days} renewalPrice={weeklyPrice} />}
      </ScrollView>

      {/* Sticky CTA + full disclosure + required links, always visible */}
      <View className="px-[21px] pt-2 gap-1.5" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <PrimaryButton
          label={ctaLabel}
          onPress={pro ? manageSubscriptions : handlePurchase}
          loading={!pro && (purchasing || !offeringsLoaded)}
          disabled={!pro && (!purchasesAvailable || restoring)}
        />
        {!!disclosure && (
          <Text className="text-fg-2 text-[11px] text-center leading-[15px] px-1">
            {disclosure}
          </Text>
        )}
        <View className="flex-row justify-center">
          <FooterLink label={restoring ? 'Restoring…' : 'Restore Purchases'} onPress={handleRestore} />
          <FooterLink label="Terms of Use" onPress={() => WebBrowser.openBrowserAsync(LEGAL.termsUrl)} />
          <FooterLink label="Privacy Policy" onPress={() => WebBrowser.openBrowserAsync(LEGAL.privacyUrl)} />
        </View>
      </View>

      {/* Close — visible and tappable from the first frame (no delayed dismiss) */}
      <View className="absolute left-3.5" style={{ top: insets.top + 4, zIndex: 10 }} pointerEvents={purchasing ? 'none' : 'auto'}>
        <CircleButton icon="close" onPress={close} accessibilityLabel="Close" />
      </View>
    </View>
  );
}
