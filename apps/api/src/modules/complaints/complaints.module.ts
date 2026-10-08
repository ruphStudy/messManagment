import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { StudentsModule } from '../students/students.module';
import { ComplaintsController, StudentComplaintsController } from './complaints.controller';
import { ComplaintsService } from './complaints.service';

@Module({
  imports: [StudentsModule, FilesModule],
  controllers: [ComplaintsController, StudentComplaintsController],
  providers: [ComplaintsService],
})
export class ComplaintsModule {}
