import api from '../api';
import type { Project, CreateProjectPayload, UpdateProjectPayload } from '@/types';

export const projectsApi = {
  list:   ()                                    => api.get<Project[]>('/projects').then((r) => r.data),
  get:    (id: string)                          => api.get<Project>(`/projects/${id}`).then((r) => r.data),
  create: (data: CreateProjectPayload)          => api.post<Project>('/projects', data).then((r) => r.data),
  update: (id: string, data: UpdateProjectPayload) => api.patch<Project>(`/projects/${id}`, data).then((r) => r.data),
  remove: (id: string)                          => api.delete(`/projects/${id}`),
};
