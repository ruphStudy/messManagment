import { Global, Module } from '@nestjs/common';
import { AdminBillingController, BillingController } from './billing.controller';
import { BillingService } from './billing.service';

/** Global: the RolesGuard checks MessMate access on mess changes. */
@Global()
@Module({
  controllers: [BillingController, AdminBillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
