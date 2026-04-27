import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from './entities/subscription.entity';
import { Plan } from './enums/plan.enum';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
  ) {}

  async createSubscription(userId: string, plan: Plan = Plan.FREE): Promise<Subscription> {
    const subscription = this.subscriptionRepository.create({ userId, plan });
    return this.subscriptionRepository.save(subscription);
  }

  async getSubscription(userId: string): Promise<Subscription> {
    const sub = await this.subscriptionRepository.findOne({ where: { userId } });
    if (!sub) throw new NotFoundException('Subscription not found');
    return sub;
  }

  async updatePlan(userId: string, updatePlanDto: UpdatePlanDto): Promise<Subscription> {
    const sub = await this.getSubscription(userId);
    sub.plan = updatePlanDto.plan;
    return this.subscriptionRepository.save(sub);
  }

  // Called after successful Stripe payment (future integration point)
  async activateSubscription(
    userId: string,
    plan: Plan,
    stripeCustomerId: string,
    stripeSubscriptionId: string,
    currentPeriodEnd: Date,
  ): Promise<Subscription> {
    const sub = await this.getSubscription(userId);
    Object.assign(sub, {
      plan,
      stripeCustomerId,
      stripeSubscriptionId,
      currentPeriodEnd,
      isActive: true,
    });
    return this.subscriptionRepository.save(sub);
  }

  async cancelSubscription(userId: string): Promise<Subscription> {
    const sub = await this.getSubscription(userId);
    sub.plan = Plan.FREE;
    sub.isActive = true; // still active on free
    sub.stripeSubscriptionId = null;
    return this.subscriptionRepository.save(sub);
  }
}
