import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, Alert, ScrollView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { AuroraBackground } from '@/components/glass/AuroraBackground';
import { GlassCard } from '@/components/glass/GlassCard';
import { GradientPillButton } from '@/components/ui/GradientPillButton';
import { useGalleryStore } from '@/stores/galleryStore';
import { useKeepStore } from '@/stores/keepStore';
import { FALLBACK_PRICING, FREE_PLAN } from '@/constants/config';
import { GRADIENTS } from '@/constants/theme';
import { formatCountdown, msUntilMidnight } from '@/lib/planUtils';
import { checkTrialEligibility, loadOfferings, purchase, restore } from '@/lib/purchases';
import { posthog } from '@/lib/posthog';

const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const PRIVACY_URL = 'https://swipephotos.app/privacy';

type PlanId = 'annual' | 'weekly';
type PaywallContext = 'sessions' | 'batch' | 'chip' | 'settings';

const PRO_FEATURES = [
  { icon: 'infinite' as const, label: 'Unlimited review sessions', sub: 'No daily limits, ever' },
  { icon: 'albums' as const, label: '100-photo batches', sub: '4× bigger sessions, 4× faster cleanup' },
  { icon: 'flash' as const, label: 'Clear your backlog this week', sub: 'Not this year' },
];

function headline(context: PaywallContext, countdown: string): { title: string; subtitle: string } {
  switch (context) {
    case 'sessions':
      return {
        title: "You're on a roll.\nDon't stop now.",
        subtitle: `Free sessions refill in ${countdown} — or keep swiping right now with unlimited sessions.`,
      };
    case 'batch':
      return {
        title: 'Unlock 100-photo\nsessions',
        subtitle: `Free plan reviews ${FREE_PLAN.maxBatchSize} photos at a time. Pro clears 100 in one sitting.`,
      };
    default:
      return {
        title: 'Clean your library\n10× faster',
        subtitle: 'Unlimited sessions, 100-photo batches, zero waiting.',
      };
  }
}

/** Weekly-equivalent price for the annual package, e.g. "$0.58". */
function perWeekPrice(pkg: PurchasesPackage | null): string {
  if (!pkg) return '$0.58';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: pkg.product.currencyCode,
    }).format(pkg.product.price / 52);
  } catch {
    return '$0.58';
  }
}

function TrialTimeline() {
  const steps = [
    { icon: 'lock-open' as const, title: 'Today: everything unlocks', sub: 'Unlimited sessions and 100-photo batches, instantly.' },
    { icon: 'notifications' as const, title: 'Day 2: reminder', sub: "We'll notify you before the trial ends. No surprises." },
    { icon: 'star' as const, title: 'Day 3: trial ends', sub: 'Billing starts — cancel anytime before in Settings.' },
  ];
  return (
    <GlassCard className="p-4 mb-4" noBlur>
      {steps.map((s, i) => (
        <View key={s.title} className="flex-row gap-3">
          <View className="items-center">
            <View className="w-8 h-8 rounded-full bg-accent/20 items-center justify-center">
              <Ionicons name={s.icon} size={15} color="#0A84FF" />
            </View>
            {i < steps.length - 1 && <View className="w-0.5 flex-1 bg-white/10 my-1" />}
          </View>
          <View className={i < steps.length - 1 ? 'flex-1 pb-4' : 'flex-1'}>
            <Text className="text-white text-[15px] font-semibold">{s.title}</Text>
            <Text className="text-white/45 text-[13px] mt-0.5">{s.sub}</Text>
          </View>
        </View>
      ))}
    </GlassCard>
  );
}

interface PlanCardProps {
  selected: boolean;
  onPress: () => void;
  title: string;
  price: string;
  priceSuffix: string;
  sub: string;
  badge?: string;
}

function PlanCard({ selected, onPress, title, price, priceSuffix, sub, badge }: PlanCardProps) {
  return (
    <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected }}>
      <View
        className={
          selected
            ? 'rounded-3xl border-2 border-accent bg-accent/10 px-4 py-3.5'
            : 'rounded-3xl border border-white/10 bg-white/[0.04] px-4 py-3.5'
        }
      >
        {badge && (
          <View className="absolute -top-2.5 right-4 rounded-full overflow-hidden">
            <LinearGradient
              colors={GRADIENTS.star}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ paddingHorizontal: 10, paddingVertical: 3 }}
            >
              <Text className="text-black text-[11px] font-extrabold">{badge}</Text>
            </LinearGradient>
          </View>
        )}
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View
              className={
                selected
                  ? 'w-5 h-5 rounded-full bg-accent items-center justify-center'
                  : 'w-5 h-5 rounded-full border border-white/30'
              }
            >
              {selected && <Ionicons name="checkmark" size={12} color="white" />}
            </View>
            <View>
              <Text className="text-white text-[16px] font-bold">{title}</Text>
              <Text className="text-white/45 text-[12px] mt-0.5">{sub}</Text>
            </View>
          </View>
          <View className="items-end">
            <Text className="text-white text-[17px] font-extrabold">{price}</Text>
            <Text className="text-white/40 text-[12px]">{priceSuffix}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ context?: string }>();
  const context = (params.context ?? 'settings') as PaywallContext;

  const index = useGalleryStore((s) => s.index);
  const keepIds = useKeepStore((s) => s.keepIds);

  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [offeringsLoaded, setOfferingsLoaded] = useState(false);
  const [trialEligible, setTrialEligible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>('annual');
  const [purchasing, setPurchasing] = useState(false);
  const [closeEnabled, setCloseEnabled] = useState(false);

  // Live refill countdown (sessions context) — minute precision is enough
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (context !== 'sessions') return;
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, [context]);

  // Close button: fade in after 1.5s (present but understated — no dark patterns)
  const closeOpacity = useSharedValue(0);
  useEffect(() => {
    closeOpacity.value = withDelay(1500, withTiming(1, { duration: 400 }));
    const t = setTimeout(() => setCloseEnabled(true), 1500);
    return () => clearTimeout(t);
  }, [closeOpacity]);
  const closeStyle = useAnimatedStyle(() => ({ opacity: closeOpacity.value }));

  useEffect(() => {
    posthog.capture('paywall_shown', { context });
    loadOfferings().then((o) => {
      setOffering(o);
      setOfferingsLoaded(true);
      const weeklyId = o?.weekly?.product.identifier;
      if (weeklyId) checkTrialEligibility(weeklyId).then(setTrialEligible);
    });
  }, [context]);

  const weeklyPkg = offering?.weekly ?? null;
  const annualPkg = offering?.annual ?? null;
  const purchasesAvailable = !!(weeklyPkg && annualPkg);

  const weeklyPrice = weeklyPkg?.product.priceString ?? FALLBACK_PRICING.weekly;
  const annualPrice = annualPkg?.product.priceString ?? FALLBACK_PRICING.annual;

  const { title, subtitle } = headline(context, formatCountdown(msUntilMidnight(now)));

  // Loss-framing stat: how long the backlog takes at the free pace
  const backlogLine = useMemo(() => {
    const remaining = Math.max(0, index.length - keepIds.size);
    if (remaining < 500) return null;
    const days = Math.ceil(remaining / (FREE_PLAN.sessionsPerDay * FREE_PLAN.maxBatchSize));
    const months = Math.max(1, Math.round(days / 30));
    return {
      remaining,
      pace: `At ${FREE_PLAN.sessionsPerDay * FREE_PLAN.maxBatchSize} free photos a day, that's ~${months} month${months > 1 ? 's' : ''} of cleaning. Pro clears it in days.`,
    };
  }, [index, keepIds]);

  function close() {
    posthog.capture('paywall_dismissed', { context });
    router.back();
  }

  async function handlePurchase() {
    if (!purchasesAvailable) {
      Alert.alert('Purchases Unavailable', 'The store is not reachable right now. Please try again later.');
      return;
    }
    const pkg = selectedPlan === 'annual' ? annualPkg! : weeklyPkg!;
    setPurchasing(true);
    posthog.capture('purchase_started', { package: pkg.identifier, context });
    const result = await purchase(pkg);
    setPurchasing(false);
    if (result === 'purchased') {
      posthog.capture('purchase_completed', { package: pkg.identifier, context });
      if (selectedPlan === 'weekly' && trialEligible) posthog.capture('trial_started');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } else if (result === 'failed') {
      posthog.capture('purchase_failed', { package: pkg.identifier, context });
      Alert.alert('Purchase Failed', 'Something went wrong. You have not been charged.');
    }
    // 'cancelled': user closed the Apple sheet — stay quiet, stay on the paywall
  }

  async function handleRestore() {
    const restored = await restore();
    posthog.capture('restore_completed', { restored });
    if (restored) {
      Alert.alert('Welcome Back', 'Your Pro subscription has been restored.');
      router.back();
    } else {
      Alert.alert('Nothing to Restore', 'No previous purchases were found for this Apple ID.');
    }
  }

  const showTrial = selectedPlan === 'weekly' && trialEligible;
  const ctaLabel = showTrial
    ? 'Start My 3-Day Free Trial'
    : selectedPlan === 'annual'
      ? `Unlock Unlimited — ${annualPrice}/year`
      : `Continue — ${weeklyPrice}/week`;

  return (
    <View className="flex-1 bg-bg-dark" style={{ paddingTop: insets.top }}>
      <AuroraBackground variant="onboarding" />

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 pb-4 pt-14"
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View className="items-center mb-5">
          <View className="rounded-full overflow-hidden mb-4">
            <LinearGradient
              colors={GRADIENTS.star}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ width: 64, height: 64, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="sparkles" size={30} color="black" />
            </LinearGradient>
          </View>
          <Text
            className="text-white font-extrabold text-center"
            style={{ fontSize: 32, lineHeight: 37, letterSpacing: -0.8 }}
          >
            {title}
          </Text>
          <Text className="text-white/55 text-[15px] text-center mt-3" style={{ lineHeight: 22, maxWidth: 310 }}>
            {subtitle}
          </Text>
        </View>

        {/* Personalized loss framing */}
        {backlogLine && (
          <Animated.View entering={FadeIn.delay(200)}>
            <GlassCard className="p-4 mb-4 flex-row items-center gap-3" noBlur>
              <View className="w-10 h-10 rounded-full bg-streak/15 items-center justify-center">
                <Ionicons name="hourglass" size={18} color="#FF9F0A" />
              </View>
              <View className="flex-1">
                <Text className="text-white text-[15px] font-bold">
                  {backlogLine.remaining.toLocaleString()} photos still waiting
                </Text>
                <Text className="text-white/50 text-[13px] mt-0.5" style={{ lineHeight: 18 }}>
                  {backlogLine.pace}
                </Text>
              </View>
            </GlassCard>
          </Animated.View>
        )}

        {/* Features */}
        <View className="gap-2.5 mb-5">
          {PRO_FEATURES.map((f) => (
            <View key={f.label} className="flex-row items-center gap-3">
              <View className="w-8 h-8 rounded-full bg-accent/15 items-center justify-center">
                <Ionicons name={f.icon} size={15} color="#0A84FF" />
              </View>
              <View className="flex-1">
                <Text className="text-white text-[15px] font-semibold">{f.label}</Text>
                <Text className="text-white/40 text-[12px]">{f.sub}</Text>
              </View>
              <Ionicons name="checkmark-circle" size={18} color="#30D158" />
            </View>
          ))}
        </View>

        {/* Plan cards */}
        <View className="gap-3 mb-4">
          <PlanCard
            selected={selectedPlan === 'annual'}
            onPress={() => setSelectedPlan('annual')}
            title="Yearly"
            price={annualPrice}
            priceSuffix="per year"
            sub={`Just ${perWeekPrice(annualPkg)}/week`}
            badge="BEST VALUE · SAVE 88%"
          />
          <PlanCard
            selected={selectedPlan === 'weekly'}
            onPress={() => setSelectedPlan('weekly')}
            title="Weekly"
            price={weeklyPrice}
            priceSuffix="per week"
            sub={trialEligible ? '3-day free trial included' : 'Flexible, cancel anytime'}
          />
        </View>

        {/* Trial timeline (weekly + eligible only) */}
        {showTrial && <TrialTimeline />}

        {/* Reassurance strip */}
        <View className="flex-row items-center justify-center gap-1.5 mb-4">
          <Ionicons name="shield-checkmark" size={13} color="rgba(255,255,255,0.35)" />
          <Text className="text-white/35 text-[12px]">
            Cancel anytime · Private by design · No ads, ever
          </Text>
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View className="px-6 gap-2.5" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
        <GradientPillButton
          label={ctaLabel}
          onPress={handlePurchase}
          loading={purchasing || !offeringsLoaded}
          disabled={offeringsLoaded && !purchasesAvailable}
        />
        <Text className="text-white/30 text-[11px] text-center" style={{ lineHeight: 15 }}>
          {showTrial
            ? `Free for 3 days, then ${weeklyPrice}/week. Auto-renews until cancelled in Settings.`
            : `Auto-renews ${selectedPlan === 'annual' ? `at ${annualPrice}/year` : `at ${weeklyPrice}/week`} until cancelled in Settings.`}
        </Text>
        <View className="flex-row justify-center gap-5 pb-1">
          <Pressable onPress={handleRestore} hitSlop={8}>
            <Text className="text-white/40 text-[12px]">Restore Purchases</Text>
          </Pressable>
          <Pressable onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)} hitSlop={8}>
            <Text className="text-white/40 text-[12px]">Terms</Text>
          </Pressable>
          <Pressable onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)} hitSlop={8}>
            <Text className="text-white/40 text-[12px]">Privacy</Text>
          </Pressable>
        </View>
      </View>

      {/* Delayed-fade close — rendered last so it wins the hit test over the ScrollView */}
      <Animated.View
        style={[closeStyle, { position: 'absolute', left: 20, top: insets.top + 8, zIndex: 10 }]}
        pointerEvents={closeEnabled ? 'auto' : 'none'}
      >
        <Pressable
          onPress={close}
          disabled={purchasing}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close"
          className="w-9 h-9 rounded-full bg-white/10 items-center justify-center"
        >
          <Ionicons name="close" size={20} color="rgba(255,255,255,0.6)" />
        </Pressable>
      </Animated.View>
    </View>
  );
}
