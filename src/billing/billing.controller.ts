import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Billing')
@ApiBearerAuth('JWT')
@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('subscription')
  @ApiOperation({ summary: 'Get current subscription / plan' })
  getSubscription(@CurrentUser() user: any) {
    return this.billingService.getSubscription(user.sub);
  }

  @Patch('plan')
  @ApiOperation({ summary: 'Update plan (use for testing; production driven by Stripe webhooks)' })
  updatePlan(@CurrentUser() user: any, @Body() updatePlanDto: UpdatePlanDto) {
    return this.billingService.updatePlan(user.sub, updatePlanDto);
  }
}
