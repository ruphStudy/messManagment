import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { ExpenseCategoriesController, ExpensesController, FinanceController } from './expenses.controller';
import { ExpenseCategoriesService } from './expense-categories.service';
import { ExpenseSummaryService } from './expense-summary.service';
import { ExpensesService } from './expenses.service';

@Module({
  imports: [PaymentsModule],
  controllers: [ExpensesController, ExpenseCategoriesController, FinanceController],
  providers: [ExpensesService, ExpenseCategoriesService, ExpenseSummaryService],
})
export class ExpensesModule {}
