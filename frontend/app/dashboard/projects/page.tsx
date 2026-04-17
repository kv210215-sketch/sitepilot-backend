'use client';
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProjectForm } from '@/components/projects/ProjectForm';
import { projectsApi } from '@/lib/api/projects';
import type { Project, CreateProjectPayload } from '@/types';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating]   = useState(false);

  const load = () =>
    projectsApi.list().then(setProjects).catch(() => toast.error('Failed to load projects')).finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleCreate = async (payload: CreateProjectPayload) => {
    setCreating(true);
    try {
      const p = await projectsApi.create(payload);
      setProjects((prev) => [p, ...prev]);
      setShowModal(false);
      toast.success('Project created');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
          <p className="text-sm text-gray-500 mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={16} className="mr-1.5" /> New Project
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}><CardBody><div className="h-24 animate-pulse rounded bg-gray-100" /></CardBody></Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState title="No projects yet" description="Create your first project to get started."
          action={{ label: 'New Project', onClick: () => setShowModal(true) }} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <a key={p.id} href={`/dashboard/projects/${p.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardBody>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 truncate">{p.name}</h3>
                    <span className={`ml-2 shrink-0 text-xs px-2 py-0.5 rounded-full ${p.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.isPublished ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  {p.description && <p className="text-sm text-gray-500 line-clamp-2">{p.description}</p>}
                  {p.domain && <p className="mt-2 text-xs text-gray-400">{p.domain}</p>}
                </CardBody>
              </Card>
            </a>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Project">
        <ProjectForm onSubmit={handleCreate} onCancel={() => setShowModal(false)} />
      </Modal>
    </div>
  );
}
