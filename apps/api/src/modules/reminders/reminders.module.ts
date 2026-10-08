import { Module } from '@nestjs/common';
import { ExpiryReminderJob } from './expiry-reminder.job';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

@Module({
  controllers: [RemindersController],
  providers: [RemindersService, ExpiryReminderJob],
})
export class RemindersModule {}
