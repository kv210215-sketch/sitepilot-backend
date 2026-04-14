import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { BillingService } from './billing.service';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('subscription')
  getSubscription(@CurrentUser() user: any) {
    return this.billingService.getSubscription(user.sub);
  }

  // For testing / admin use — in production this should be driven by Stripe webhooks
  @Patch('plan')
  updatePlan(@CurrentUser() user: any, @Body() updatePlanDto: UpdatePlanDto) {
    return this.billingService.updatePlan(user.sub, updatePlanDto);
  }
}
