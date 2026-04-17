// ── Auth ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'user';
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

// ── Projects ─────────────────────────────────────────────────────────────────
export interface Project {
  id: string;
  name: string;
  description: string | null;
  slug: string | null;
  userId: string;
  isPublished: boolean;
  publishedUrl: string | null;
  pages?: Page[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectPayload {
  name: string;
  description?: string;
  slug?: string;
}

export interface UpdateProjectPayload {
  name?: string;
  description?: string;
  slug?: string;
}

// ── Pages ─────────────────────────────────────────────────────────────────────
export interface Page {
  id: string;
  title: string;
  slug: string | null;
  content: Record<string, unknown>;
  isPublished: boolean;
  projectId: string;
  metaTitle: string | null;
  metaDescription: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePagePayload {
  title: string;
  slug?: string;
  content?: Record<string, unknown>;
  isPublished?: boolean;
  metaTitle?: string;
  metaDescription?: string;
  order?: number;
}

export interface UpdatePagePayload {
  title?: string;
  slug?: string;
  content?: Record<string, unknown>;
  isPublished?: boolean;
  metaTitle?: string;
  metaDescription?: string;
  order?: number;
}

// ── Billing ───────────────────────────────────────────────────────────────────
export type Plan = 'free' | 'pro' | 'agency';

export interface Subscription {
  id: string;
  userId: string;
  plan: Plan;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Publish ───────────────────────────────────────────────────────────────────
export interface PublishResult {
  status: 'published';
  projectId: string;
  projectName: string;
  pagesCount: number;
  publishedUrl: string;
  timestamp: string;
}
