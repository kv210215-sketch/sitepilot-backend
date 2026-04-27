'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageForm } from '@/components/pages/PageForm';
import { pagesApi } from '@/lib/api/pages';
import type { Page, CreatePagePayload } from '@/types';

export default function PagesListPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [pages, setPages]     = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating]   = useState(false);

  const load = () =>
    pagesApi.list(projectId).then(setPages).catch(() => toast.error('Failed to load pages')).finally(() => setLoading(false));

  useEffect(() => { load(); }, [projectId]);

  const handleCreate = async (payload: CreatePagePayload) => {
    setCreating(true);
    try {
      const page = await pagesApi.create(projectId, payload);
      setPages((prev) => [page, ...prev]);
      setShowModal(false);
      toast.success('Page created');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create page');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pages</h2>
          <p className="text-sm text-gray-500 mt-1">{pages.length} page{pages.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus size={16} className="mr-1.5" /> New Page
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}><CardBody><div className="h-12 animate-pulse rounded bg-gray-100" /></CardBody></Card>
          ))}
        </div>
      ) : pages.length === 0 ? (
        <EmptyState title="No pages yet" description="Create your first page for this project."
          action={{ label: 'New Page', onClick: () => setShowModal(true) }} />
      ) : (
        <div className="space-y-3">
          {pages.map((pg) => (
            <a key={pg.id} href={`/dashboard/projects/${projectId}/pages/${pg.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardBody className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{pg.title}</p>
                    <p className="text-xs text-gray-400">/{pg.slug}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${pg.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {pg.isPublished ? 'Live' : 'Draft'}
                  </span>
                </CardBody>
              </Card>
            </a>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Page">
        <PageForm onSubmit={handleCreate} onCancel={() => setShowModal(false)} />
      </Modal>
    </div>
  );
}
