import { Module } from '@nestjs/common';
import { StudentImportService } from './student-import.service';
import { StudentLinkService } from './student-link.service';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  controllers: [StudentsController],
  providers: [StudentsService, StudentLinkService, StudentImportService],
  exports: [StudentLinkService, StudentsService],
})
export class StudentsModule {}
