import { Module } from '@nestjs/common';
import { ComplaintsModule } from '../complaints/complaints.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { FeedbackModule } from '../feedback/feedback.module';
import { MenusModule } from '../menus/menus.module';
import { PausesModule } from '../pauses/pauses.module';
import { PaymentsModule } from '../payments/payments.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [PausesModule, MenusModule, PaymentsModule, ExpensesModule, FeedbackModule, ComplaintsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
