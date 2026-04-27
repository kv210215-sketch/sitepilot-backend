import { IsEnum } from 'class-validator';
import { Plan } from '../enums/plan.enum';

export class UpdatePlanDto {
  @IsEnum(Plan)
  plan: Plan;
}
