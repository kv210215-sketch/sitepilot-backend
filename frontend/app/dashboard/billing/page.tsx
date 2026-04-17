'use client';
import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { billingApi } from '@/lib/api/billing';
import type { Subscription } from '@/types';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    features: ['1 project', '5 pages', 'Basic SEO tools'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$29/mo',
    features: ['Unlimited projects', 'Unlimited pages', 'Advanced SEO', 'AI tools'],
  },
  {
    id: 'agency',
    name: 'Agency',
    price: '$99/mo',
    features: ['Everything in Pro', 'White-label', 'Priority support', 'Team members'],
  },
] as const;

export default function BillingPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading]           = useState(true);
  const [upgrading, setUpgrading]       = useState<string | null>(null);

  useEffect(() => {
    billingApi.getSubscription()
      .then(setSubscription)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = async (plan: string) => {
    setUpgrading(plan);
    try {
      const updated = await billingApi.upgrade(plan as any);
      setSubscription(updated);
      toast.success(`Upgraded to ${plan}!`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Upgrade failed');
    } finally {
      setUpgrading(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Billing</h2>
        <p className="text-sm text-gray-500 mt-1">Manage your subscription plan</p>
      </div>

      {!loading && subscription && (
        <Card>
          <CardBody className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Current plan</p>
              <p className="text-lg font-bold capitalize text-gray-900">{subscription.plan}</p>
              {subscription.currentPeriodEnd && (
                <p className="text-xs text-gray-400">Renews {new Date(subscription.currentPeriodEnd).toLocaleDateString()}</p>
              )}
            </div>
            <Badge variant={subscription.plan === 'free' ? 'gray' : 'green'} className="text-sm px-3 py-1">
              {subscription.plan === 'free' ? 'Free tier' : 'Active'}
            </Badge>
          </CardBody>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = subscription?.plan === plan.id;
          return (
            <Card key={plan.id} className={isCurrent ? 'ring-2 ring-blue-500' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-900">{plan.name}</h3>
                  {isCurrent && <Badge variant="blue">Current</Badge>}
                </div>
                <p className="text-2xl font-bold text-gray-900 mt-1">{plan.price}</p>
              </CardHeader>
              <CardBody className="space-y-3">
                <ul className="space-y-1.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                      <Check size={14} className="text-green-500 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full mt-2"
                  variant={isCurrent ? 'secondary' : 'primary'}
                  disabled={isCurrent || loading}
                  loading={upgrading === plan.id}
                  onClick={() => !isCurrent && handleUpgrade(plan.id)}
                >
                  {isCurrent ? 'Current plan' : `Upgrade to ${plan.name}`}
                </Button>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
