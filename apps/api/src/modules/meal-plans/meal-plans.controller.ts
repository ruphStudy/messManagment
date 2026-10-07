import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '@mess/shared';
import { CurrentMessId, RequireMess, RequirePermissions } from '../../common/decorators/auth.decorators';
import { UuidParam } from '../../common/http/params';
import { CreateMealPlanDto, ListMealPlansQueryDto, UpdateMealPlanDto, UpdateMealPlanStatusDto } from './dto/meal-plan.dto';
import { MealPlansService } from './meal-plans.service';

const PlanId = () => UuidParam('id', 'Meal plan');

@ApiTags('meal-plans')
@Controller('meal-plans')
@RequireMess()
export class MealPlansController {
  constructor(private readonly plans: MealPlansService) {}

  @Get()
  @RequirePermissions(Permission.MEAL_PLAN_VIEW)
  list(@CurrentMessId() messId: string, @Query() query: ListMealPlansQueryDto) {
    return this.plans.list(messId, query);
  }

  @Post()
  @RequirePermissions(Permission.MEAL_PLAN_MANAGE)
  create(@CurrentMessId() messId: string, @Body() dto: CreateMealPlanDto) {
    return this.plans.create(messId, dto);
  }

  @Get(':id')
  @RequirePermissions(Permission.MEAL_PLAN_VIEW)
  get(@CurrentMessId() messId: string, @PlanId() id: string) {
    return this.plans.get(messId, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.MEAL_PLAN_MANAGE)
  update(@CurrentMessId() messId: string, @PlanId() id: string, @Body() dto: UpdateMealPlanDto) {
    return this.plans.update(messId, id, dto);
  }

  @Patch(':id/status')
  @RequirePermissions(Permission.MEAL_PLAN_MANAGE)
  setStatus(@CurrentMessId() messId: string, @PlanId() id: string, @Body() dto: UpdateMealPlanStatusDto) {
    return this.plans.setStatus(messId, id, dto.status);
  }
}
