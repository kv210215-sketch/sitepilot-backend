import api from '../api';
import type { Subscription, Plan } from '@/types';

export const billingApi = {
  getSubscription: ()             => api.get<Subscription>('/billing/subscription').then((r) => r.data),
  updatePlan:      (plan: Plan)   => api.patch<Subscription>('/billing/plan', { plan }).then((r) => r.data),
  upgrade:         (plan: Plan)   => api.patch<Subscription>('/billing/plan', { plan }).then((r) => r.data),
};
