import { Module } from '@nestjs/common';
import { MealPlansModule } from '../meal-plans/meal-plans.module';
import { StudentsModule } from '../students/students.module';
import { StudentSubscriptionsController, SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [MealPlansModule, StudentsModule],
  controllers: [SubscriptionsController, StudentSubscriptionsController],
  providers: [SubscriptionsService],
})
export class SubscriptionsModule {}
