import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BUSINESS_TIME_ZONE } from '@mess/shared';
import { APP_CONFIG, AppConfig } from '../../config/app-config';
import { RemindersService } from './reminders.service';

/** Daily 09:00 IST. Idempotent (dedupe keys in the database), so restarts or extra runs never duplicate. */
@Injectable()
export class ExpiryReminderJob {
  private readonly logger = new Logger(ExpiryReminderJob.name);

  constructor(
    private readonly reminders: RemindersService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Cron('0 9 * * *', { name: 'subscription-expiry-reminders', timeZone: BUSINESS_TIME_ZONE })
  async run() {
    if (!this.config.schedulerEnabled) return;
    try {
      const result = await this.reminders.runExpiry();
      this.logger.log(`Expiry reminders ${result.date}: ${result.notified} sent, ${result.skippedDuplicates} already sent`);
    } catch (error) {
      this.logger.error(`Expiry reminder job failed: ${(error as Error).message}`);
    }
  }
}
