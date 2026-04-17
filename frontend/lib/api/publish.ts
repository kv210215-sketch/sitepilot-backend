import api from '../api';
import type { PublishResult } from '@/types';

export const publishApi = {
  publish: (projectId: string) =>
    api.post<PublishResult>(`/publish/project/${projectId}`).then((r) => r.data),
};
