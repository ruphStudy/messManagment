import { Module } from '@nestjs/common';
import { StudentsModule } from '../students/students.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AttendanceController, StudentAttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { MealQrService } from './meal-qr.service';

@Module({
  imports: [StudentsModule, SubscriptionsModule],
  controllers: [AttendanceController, StudentAttendanceController],
  providers: [AttendanceService, MealQrService],
})
export class AttendanceModule {}
