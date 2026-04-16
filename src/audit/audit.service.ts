import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
  ) {}

  log(action: string, actorId?: string, metadata?: Record<string, unknown>): Promise<AuditLog> {
    const entry = this.auditRepository.create({ action, actorId, metadata });
    return this.auditRepository.save(entry);
  }
}
