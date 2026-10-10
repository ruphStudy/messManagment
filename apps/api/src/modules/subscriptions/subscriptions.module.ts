import { Module } from '@nestjs/common';
import { MealPlansModule } from '../meal-plans/meal-plans.module';
import { StudentsModule } from '../students/students.module';
import { StudentSubscriptionsController, SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { PlanRequestsController, StudentPlanRequestsController } from './plan-requests.controller';
import { PlanRequestsService } from './plan-requests.service';

@Module({
  imports: [MealPlansModule, StudentsModule],
  controllers: [SubscriptionsController, StudentSubscriptionsController, PlanRequestsController, StudentPlanRequestsController],
  providers: [SubscriptionsService, PlanRequestsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
