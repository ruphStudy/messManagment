import { Module } from '@nestjs/common';
import { StudentsModule } from '../students/students.module';
import { PaymentsController, StudentPaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [StudentsModule],
  controllers: [PaymentsController, StudentPaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
