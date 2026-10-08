import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentAuth } from '../../common/decorators/auth.decorators';
import type { RequestAuth } from '../../common/auth.types';
import { UuidParam } from '../../common/http/params';
import { ListNotificationsQueryDto, RegisterPushDeviceDto, UnregisterPushDeviceDto, UpdatePreferencesDto } from './dto/notification.dto';
import { NotificationsService } from './notifications.service';
import { PushDevicesService } from './push-devices.service';

/** Every route acts on the signed-in user's own data only (any role). */
@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentAuth() auth: RequestAuth, @Query() query: ListNotificationsQueryDto) {
    return this.notifications.list(auth.user.id, query);
  }

  @Get('unread-count')
  unreadCount(@CurrentAuth() auth: RequestAuth) {
    return this.notifications.unreadCount(auth.user.id);
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  readAll(@CurrentAuth() auth: RequestAuth) {
    return this.notifications.markAllRead(auth.user.id);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  read(@CurrentAuth() auth: RequestAuth, @UuidParam('id', 'Notification') id: string) {
    return this.notifications.markRead(auth.user.id, id);
  }
}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notification-preferences')
export class NotificationPreferencesController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  get(@CurrentAuth() auth: RequestAuth) {
    return this.notifications.getPreferences(auth.user.id);
  }

  @Patch()
  update(@CurrentAuth() auth: RequestAuth, @Body() dto: UpdatePreferencesDto) {
    return this.notifications.updatePreferences(auth.user.id, dto);
  }
}

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('push-devices')
export class PushDevicesController {
  constructor(private readonly devices: PushDevicesService) {}

  @Post('register')
  @HttpCode(HttpStatus.OK)
  register(@CurrentAuth() auth: RequestAuth, @Body() dto: RegisterPushDeviceDto) {
    return this.devices.register(auth.user.id, dto.pushToken, dto.platform, dto.deviceLabel);
  }

  @Post('unregister')
  @HttpCode(HttpStatus.OK)
  unregister(@CurrentAuth() auth: RequestAuth, @Body() dto: UnregisterPushDeviceDto) {
    return this.devices.unregister(auth.user.id, dto.pushToken);
  }
}
