import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import {
  NOTIFICATION_LIMITS,
  NotificationType,
  PushPlatform,
  type NotificationListQuery,
  type NotificationPreferences,
  type RegisterPushDeviceRequest,
} from '@mess/shared';
import { PaginationQueryDto } from '../../../common/http/pagination';
import { OptionalText } from '../../../common/http/validators';

export class ListNotificationsQueryDto extends PaginationQueryDto implements NotificationListQuery {
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  unreadOnly?: boolean;

  @IsOptional()
  @IsIn(Object.values(NotificationType))
  type?: NotificationType;
}

export class UpdatePreferencesDto implements Partial<NotificationPreferences> {
  @IsOptional() @IsBoolean() paymentDueEnabled?: boolean;
  @IsOptional() @IsBoolean() subscriptionExpiryEnabled?: boolean;
  @IsOptional() @IsBoolean() menuUpdatesEnabled?: boolean;
  @IsOptional() @IsBoolean() pauseUpdatesEnabled?: boolean;
  @IsOptional() @IsBoolean() pushEnabled?: boolean;
}

/** Expo push tokens look like ExponentPushToken[xxxx] (or ExpoPushToken[xxxx]). */
const EXPO_TOKEN = /^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$/;

export class RegisterPushDeviceDto implements RegisterPushDeviceRequest {
  @IsString()
  @MaxLength(NOTIFICATION_LIMITS.pushTokenMax)
  @Matches(EXPO_TOKEN, { message: 'Invalid push token' })
  pushToken: string;

  @IsIn(Object.values(PushPlatform))
  platform: PushPlatform;

  @OptionalText(80)
  deviceLabel?: string;
}

export class UnregisterPushDeviceDto {
  @IsString()
  @MaxLength(NOTIFICATION_LIMITS.pushTokenMax)
  pushToken: string;
}
