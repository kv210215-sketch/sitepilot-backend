'use client';
import { useEffect, useState } from 'react';
import { FolderOpen, FileText, Globe, TrendingUp } from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { projectsApi } from '@/lib/api/projects';
import { billingApi } from '@/lib/api/billing';
import type { Project, Subscription } from '@/types';

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string | number; color: string;
}) {
  return (
    <Card>
      <CardBody className="flex items-center gap-4">
        <div className={`flex size-12 items-center justify-center rounded-xl ${color}`}>
          <Icon size={22} className="text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500">{label}</p>
        </div>
      </CardBody>
    </Card>
  );
}

export default function DashboardPage() {
  const [projects, setProjects]         = useState<Project[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    Promise.all([projectsApi.list(), billingApi.getSubscription()])
      .then(([p, s]) => { setProjects(p); setSubscription(s); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const published   = projects.filter((p) => p.isPublished).length;
  const totalPages  = projects.reduce((sum, p) => sum + (p.pages?.length ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500 mt-1">Overview of your SitePilot workspace</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardBody><div className="h-16 animate-pulse rounded bg-gray-100" /></CardBody></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard icon={FolderOpen}  label="Total Projects"     value={projects.length} color="bg-blue-500" />
          <StatCard icon={Globe}       label="Published"          value={published}        color="bg-green-500" />
          <StatCard icon={FileText}    label="Total Pages"        value={totalPages}       color="bg-purple-500" />
          <StatCard icon={TrendingUp}  label="Plan"               value={subscription?.plan ?? 'free'} color="bg-orange-500" />
        </div>
      )}

      <Card>
        <CardBody>
          <h3 className="mb-3 font-semibold text-gray-900">Recent Projects</h3>
          {projects.length === 0 ? (
            <p className="text-sm text-gray-400">No projects yet. <a href="/dashboard/projects" className="text-blue-600 hover:underline">Create one</a></p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {projects.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <a href={`/dashboard/projects/${p.id}`} className="text-sm font-medium text-gray-900 hover:text-blue-600">{p.name}</a>
                    {p.domain && <p className="text-xs text-gray-400">{p.domain}</p>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${p.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.isPublished ? 'Published' : 'Draft'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
