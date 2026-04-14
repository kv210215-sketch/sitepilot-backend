import { Injectable } from '@nestjs/common';
import { ProjectsService } from '../projects/projects.service';
import { slugify } from '../common/utils/slugify';

export interface PublishResult {
  status: 'published';
  projectId: string;
  projectName: string;
  pagesCount: number;
  publishedUrl: string;
  timestamp: string;
}

@Injectable()
export class PublishService {
  constructor(private readonly projectsService: ProjectsService) {}

  async publishProject(projectId: string, userId: string): Promise<PublishResult> {
    // Load project with pages — also verifies ownership
    const project = await this.projectsService.findOneWithPages(projectId, userId);

    const resolvedSlug = project.slug || slugify(project.name);
    const publishedUrl = `/sites/${resolvedSlug}`;

    // Persist published state + URL on the project record
    await this.projectsService.markPublished(projectId, userId, publishedUrl);

    return {
      status: 'published',
      projectId: project.id,
      projectName: project.name,
      pagesCount: project.pages?.length ?? 0,
      publishedUrl,
      timestamp: new Date().toISOString(),
    };
  }
}
