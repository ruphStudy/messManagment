import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../../config/app-config';
import { NotificationPreferencesController, NotificationsController, PushDevicesController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PushDevicesService } from './push-devices.service';
import { DisabledPushProvider, ExpoPushProvider, LogPushProvider, PUSH_PROVIDER } from './push/push.provider';

/** Global so any business module can raise notifications without import wiring. */
@Global()
@Module({
  controllers: [NotificationsController, NotificationPreferencesController, PushDevicesController],
  providers: [
    NotificationsService,
    PushDevicesService,
    {
      provide: PUSH_PROVIDER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        config.pushProvider === 'expo'
          ? new ExpoPushProvider(config.expoPushUrl, config.expoAccessToken)
          : config.pushProvider === 'log'
            ? new LogPushProvider()
            : new DisabledPushProvider(),
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
