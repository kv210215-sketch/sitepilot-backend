'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import type { Project, CreateProjectPayload } from '@/types';

interface Props {
  initial?: Partial<Project>;
  onSubmit: (data: CreateProjectPayload) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

export function ProjectForm({ initial, onSubmit, onCancel, submitLabel = 'Create' }: Props) {
  const [name, setName]        = useState(initial?.name || '');
  const [description, setDesc] = useState(initial?.description || '');
  const [loading, setLoading]  = useState(false);
  const [error, setError]      = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setLoading(true);
    try {
      await onSubmit({ name: name.trim(), description: description.trim() || undefined });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Project name" value={name} onChange={(e) => setName(e.target.value)}
        placeholder="My Awesome Site" autoFocus error={error} />
      <Textarea label="Description (optional)" value={description}
        onChange={(e) => setDesc(e.target.value)} rows={3}
        placeholder="What is this project about?" />
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={loading}>{submitLabel}</Button>
      </div>
    </form>
  );
}
