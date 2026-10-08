import { Module } from '@nestjs/common';
import { AttendanceModule } from '../attendance/attendance.module';
import { ComplaintsModule } from '../complaints/complaints.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { ReportsModule } from '../reports/reports.module';
import { AdminController } from './admin.controller';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminMessesService } from './admin-messes.service';
import { AdminSystemService } from './admin-system.service';
import { AdminUsersService } from './admin-users.service';

@Module({
  imports: [AttendanceModule, ComplaintsModule, ExpensesModule, ReportsModule],
  controllers: [AdminController],
  providers: [AdminDashboardService, AdminMessesService, AdminUsersService, AdminSystemService],
})
export class AdminModule {}
