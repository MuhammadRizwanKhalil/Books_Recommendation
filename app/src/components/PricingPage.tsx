/**
 * Pricing / Subscription Page
 * Shows available tiers, current subscription, and upgrade/cancel actions.
 */

import { useState, useEffect } from 'react';
import { Check, Crown, Zap, Star } from 'lucide-react';
import { subscriptionsApi, type TierInfo, type SubscriptionInfo } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/components/AuthProvider';
import { toast } from 'sonner';

const tierIcons: Record<string, typeof Star> = {
  free: Star,
  plus: Zap,
  premium: Crown,
};

const tierColors: Record<string, string> = {
  free: 'border-border',
  plus: 'border-blue-400 shadow-blue-100',
  premium: 'border-yellow-400 shadow-yellow-100',
};

export function PricingPage() {
  const { user } = useAuth();
  const [tiers, setTiers] = useState<TierInfo[]>([]);
  const [current, setCurrent] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [interval, setInterval] = useState<'month' | 'year'>('month');

  useEffect(() => {
    Promise.all([
      subscriptionsApi.tiers().then(d => setTiers(d.tiers)),
      user ? subscriptionsApi.current().then(d => setCurrent(d)).catch(() => {}) : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, [user]);

  async function handleSubscribe(plan: 'plus' | 'premium') {
    if (!user) {
      toast.error('Please sign in to subscribe');
      return;
    }
    setSubscribing(true);
    try {
      const result = await subscriptionsApi.subscribe(plan, interval);
      toast.success(result.message);
      setCurrent({ tier: result.tier, expiresAt: result.expiresAt, subscription: null });
    } catch (err: any) {
      toast.error(err.message || 'Failed to subscribe');
    } finally {
      setSubscribing(false);
    }
  }

  async function handleCancel() {
    try {
      const result = await subscriptionsApi.cancel();
      toast.success(result.message);
      setCurrent({ tier: 'free', expiresAt: null, subscription: null });
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel');
    }
  }

  const currentTier = current?.tier || 'free';

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold mb-3">Choose Your Plan</h1>
        <p className="text-lg text-muted-foreground">Unlock premium features to enhance your reading experience.</p>

        {/* Interval toggle */}
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            variant={interval === 'month' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setInterval('month')}
          >
            Monthly
          </Button>
          <Button
            variant={interval === 'year' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setInterval('year')}
          >
            Annual <Badge variant="secondary" className="ml-2 text-xs">Save 17%</Badge>
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {tiers.map(tier => {
          const Icon = tierIcons[tier.id] || Star;
          const isCurrent = currentTier === tier.id;
          const price = interval === 'year' ? Math.round(tier.price * 10 / 100) : Math.round(tier.price / 100);
          const isPaid = tier.id !== 'free';

          return (
            <Card
              key={tier.id}
              className={`relative transition-all ${tierColors[tier.id] || ''} ${isCurrent ? 'ring-2 ring-primary' : ''}`}
            >
              {isCurrent && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Current Plan</Badge>
              )}
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">{tier.name}</CardTitle>
                <CardDescription>
                  {isPaid ? (
                    <>
                      <span className="text-3xl font-bold text-foreground">${price}</span>
                      <span className="text-muted-foreground">/{interval === 'year' ? 'yr' : 'mo'}</span>
                    </>
                  ) : (
                    <span className="text-3xl font-bold text-foreground">Free</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-6">
                  {Object.entries(tier.features).map(([key, value]) => {
                    const desc = tier.descriptions[key] || key.replace(/_/g, ' ');
                    const isEnabled = value === 'true' || value === 'unlimited' || parseInt(value) > 0;
                    return (
                      <li key={key} className={`flex items-center gap-2 text-sm ${isEnabled ? '' : 'text-muted-foreground line-through'}`}>
                        <Check className={`h-4 w-4 flex-shrink-0 ${isEnabled ? 'text-green-500' : 'text-muted-foreground'}`} />
                        {desc}
                        {value !== 'true' && value !== 'false' && (
                          <Badge variant="outline" className="ml-auto text-xs">{value}</Badge>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {isCurrent ? (
                  isPaid ? (
                    <Button variant="outline" className="w-full" onClick={handleCancel}>
                      Cancel Plan
                    </Button>
                  ) : (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  )
                ) : isPaid ? (
                  <Button
                    className="w-full"
                    onClick={() => handleSubscribe(tier.id as 'plus' | 'premium')}
                    disabled={subscribing || !user}
                  >
                    {subscribing ? 'Processing...' : `Upgrade to ${tier.name}`}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {current?.subscription && (
        <div className="mt-8 p-4 border rounded-lg bg-muted/50">
          <h3 className="font-semibold mb-2">Current Subscription Details</h3>
          <p className="text-sm text-muted-foreground">
            Plan: <strong>{current.subscription.plan}</strong> ·
            Status: <Badge variant={current.subscription.status === 'active' ? 'default' : 'secondary'}>{current.subscription.status}</Badge> ·
            Period ends: {current.subscription.currentPeriodEnd ? new Date(current.subscription.currentPeriodEnd).toLocaleDateString() : 'N/A'}
          </p>
        </div>
      )}
    </div>
  );
}
