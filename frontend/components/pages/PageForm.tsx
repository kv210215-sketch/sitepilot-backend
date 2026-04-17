'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { Page, CreatePagePayload } from '@/types';

interface Props {
  initial?: Partial<Page>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

export function PageForm({ initial, onSubmit, onCancel, submitLabel = 'Create' }: Props) {
  const [title, setTitle]   = useState(initial?.title || '');
  const [slug, setSlug]     = useState(initial?.slug  || '');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required'); return; }
    setLoading(true);
    try {
      await onSubmit({ title: title.trim(), slug: slug.trim() || undefined });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Page title" value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder="Home" autoFocus error={error} />
      <Input label="Slug (optional)" value={slug} onChange={(e) => setSlug(e.target.value)}
        placeholder="home" />
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={loading}>{submitLabel}</Button>
      </div>
    </form>
  );
}
