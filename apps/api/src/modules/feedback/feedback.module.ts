import { Module } from '@nestjs/common';
import { StudentsModule } from '../students/students.module';
import { FeedbackController, StudentFeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';

@Module({
  imports: [StudentsModule],
  controllers: [FeedbackController, StudentFeedbackController],
  providers: [FeedbackService],
  exports: [FeedbackService],
})
export class FeedbackModule {}
