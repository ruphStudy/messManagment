import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { ComplaintsModule } from '../complaints/complaints.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { FeedbackModule } from '../feedback/feedback.module';
import { PausesModule } from '../pauses/pauses.module';
import { PaymentsModule } from '../payments/payments.module';
import { StudentsModule } from '../students/students.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [StudentsModule, AttendanceModule, PausesModule, SubscriptionsModule, PaymentsModule, ExpensesModule, FeedbackModule, ComplaintsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
