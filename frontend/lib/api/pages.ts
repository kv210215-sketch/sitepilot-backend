import api from '../api';
import type { Page, CreatePagePayload, UpdatePagePayload } from '@/types';

export const pagesApi = {
  list:   (projectId: string)                              => api.get<Page[]>(`/projects/${projectId}/pages`).then((r) => r.data),
  get:    (projectId: string, id: string)                  => api.get<Page>(`/projects/${projectId}/pages/${id}`).then((r) => r.data),
  create: (projectId: string, data: CreatePagePayload)     => api.post<Page>(`/projects/${projectId}/pages`, data).then((r) => r.data),
  update: (projectId: string, id: string, data: UpdatePagePayload) => api.patch<Page>(`/projects/${projectId}/pages/${id}`, data).then((r) => r.data),
  remove: (projectId: string, id: string)                  => api.delete(`/projects/${projectId}/pages/${id}`),
};
