import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const nodeEnv = this.configService.get<string>('app.nodeEnv');
    if (nodeEnv === 'production') return;

    const email = process.env.SEED_USER_EMAIL ?? 'dev@example.com';
    const password = process.env.SEED_USER_PASSWORD ?? 'dev_pass_1234';

    const existing = await this.usersService.findByEmail(email);
    if (existing) return;

    const passwordHash = await bcrypt.hash(password, 10);
    await this.usersService.createUser(email, passwordHash);
    this.logger.log(`[Seed] Created dev user: ${email}`);
  }
}
