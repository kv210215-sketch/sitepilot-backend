'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Globe, Plus, Trash2, ExternalLink, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { ProjectForm } from '@/components/projects/ProjectForm';
import { projectsApi } from '@/lib/api/projects';
import { publishApi } from '@/lib/api/publish';
import type { Project, UpdateProjectPayload } from '@/types';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const [project, setProject]       = useState<Project | null>(null);
  const [loading, setLoading]       = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [showEdit, setShowEdit]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting]     = useState(false);

  useEffect(() => {
    projectsApi.get(id)
      .then(setProject)
      .catch(() => toast.error('Project not found'))
      .finally(() => setLoading(false));
  }, [id]);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const result = await publishApi.publish(id);
      setProject((p) => p ? { ...p, isPublished: true, publishedUrl: result.publishedUrl } : p);
      toast.success('Project published!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  const handleSave = async (payload: UpdateProjectPayload) => {
    setSaving(true);
    try {
      const updated = await projectsApi.update(id, payload);
      setProject(updated);
      setShowEdit(false);
      toast.success('Project updated');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await projectsApi.remove(id);
      toast.success('Project deleted');
      router.push('/dashboard/projects');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><div className="size-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" /></div>;
  if (!project) return <p className="text-gray-500">Project not found.</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{project.name}</h2>
          {project.description && <p className="text-sm text-gray-500 mt-1">{project.description}</p>}
          {project.slug && <p className="text-xs text-gray-400 mt-0.5">/{project.slug}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowEdit(true)}><Pencil size={15} className="mr-1" />Edit</Button>
          <Button variant="danger" onClick={() => setShowDelete(true)}><Trash2 size={15} /></Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h3 className="font-semibold text-gray-900">Publishing</h3>
        </CardHeader>
        <CardBody className="flex items-center justify-between">
          <div>
            {project.isPublished ? (
              <>
                <span className="text-sm font-medium text-green-600">Published</span>
                {project.publishedUrl && (
                  <a href={project.publishedUrl} target="_blank" rel="noreferrer"
                    className="ml-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                    {project.publishedUrl} <ExternalLink size={12} />
                  </a>
                )}
              </>
            ) : (
              <span className="text-sm text-gray-500">Not published yet</span>
            )}
          </div>
          <Button onClick={handlePublish} loading={publishing}>
            <Globe size={15} className="mr-1.5" />
            {project.isPublished ? 'Re-publish' : 'Publish'}
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Pages</h3>
          <a href={`/dashboard/projects/${id}/pages`}>
            <Button variant="secondary" className="text-sm py-1.5">
              <Plus size={14} className="mr-1" /> Manage Pages
            </Button>
          </a>
        </CardHeader>
        <CardBody>
          {(!project.pages || project.pages.length === 0) ? (
            <p className="text-sm text-gray-400">No pages yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {project.pages.map((pg) => (
                <li key={pg.id} className="flex items-center justify-between py-2">
                  <div>
                    <a href={`/dashboard/projects/${id}/pages/${pg.id}`} className="text-sm font-medium text-gray-900 hover:text-blue-600">{pg.title}</a>
                    <p className="text-xs text-gray-400">{pg.slug}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${pg.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {pg.isPublished ? 'Live' : 'Draft'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Project">
        <ProjectForm initial={project} onSubmit={handleSave} onCancel={() => setShowEdit(false)} submitLabel="Save" />
      </Modal>

      <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Delete Project">
        <p className="text-sm text-gray-600 mb-4">Are you sure you want to delete <strong>{project.name}</strong>? This cannot be undone.</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setShowDelete(false)}>Cancel</Button>
          <Button variant="danger" loading={deleting} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
