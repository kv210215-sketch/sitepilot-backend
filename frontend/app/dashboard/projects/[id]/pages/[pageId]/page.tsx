'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Trash2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { PageForm } from '@/components/pages/PageForm';
import { pagesApi } from '@/lib/api/pages';
import type { Page, UpdatePagePayload } from '@/types';

export default function PageEditorPage() {
  const { id: projectId, pageId } = useParams<{ id: string; pageId: string }>();
  const router = useRouter();
  const [page, setPage]       = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    pagesApi.get(projectId, pageId)
      .then(setPage)
      .catch(() => toast.error('Page not found'))
      .finally(() => setLoading(false));
  }, [projectId, pageId]);

  const handleSave = async (payload: UpdatePagePayload) => {
    setSaving(true);
    try {
      const updated = await pagesApi.update(projectId, pageId, payload);
      setPage(updated);
      toast.success('Page saved');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this page? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await pagesApi.remove(projectId, pageId);
      toast.success('Page deleted');
      router.push(`/dashboard/projects/${projectId}/pages`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="size-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" /></div>;
  if (!page)   return <p className="text-gray-500">Page not found.</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{page.title}</h2>
            <p className="text-xs text-gray-400">/{page.slug}</p>
          </div>
        </div>
        <Button variant="danger" loading={deleting} onClick={handleDelete}>
          <Trash2 size={15} />
        </Button>
      </div>

      <Card>
        <CardBody>
          <PageForm initial={page} onSubmit={handleSave} onCancel={() => router.back()} submitLabel="Save" />
        </CardBody>
      </Card>
    </div>
  );
}
