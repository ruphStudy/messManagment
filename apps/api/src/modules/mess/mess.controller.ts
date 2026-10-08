import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '@mess/shared';
import { CurrentAuth, CurrentMessId, RequireMess, RequirePermissions } from '../../common/decorators/auth.decorators';
import type { RequestAuth } from '../../common/auth.types';
import { CreateMessDto, UpdateMessDto, UpdateMessSettingsDto } from './dto/mess.dto';
import { MessService } from './mess.service';

/**
 * The caller's own mess. The mess id always comes from the server-side membership,
 * so one mess can never read or modify another.
 */
@ApiTags('mess')
@Controller('mess')
export class MessController {
  constructor(private readonly mess: MessService) {}

  @Post()
  @RequirePermissions(Permission.MESS_CREATE)
  create(@CurrentAuth() auth: RequestAuth, @Body() dto: CreateMessDto) {
    return this.mess.create(auth, dto);
  }

  @Get()
  @RequireMess()
  @RequirePermissions(Permission.MESS_VIEW)
  get(@CurrentMessId() messId: string) {
    return this.mess.get(messId);
  }

  @Patch()
  @RequireMess()
  @RequirePermissions(Permission.MESS_UPDATE)
  update(@CurrentMessId() messId: string, @Body() dto: UpdateMessDto) {
    return this.mess.update(messId, dto);
  }

  /** Meals served, serving times and pause cut-offs — owner or manager. */
  @Patch('settings')
  @RequireMess()
  @RequirePermissions(Permission.MESS_SETTINGS_UPDATE)
  updateSettings(@CurrentMessId() messId: string, @Body() dto: UpdateMessSettingsDto) {
    return this.mess.update(messId, dto);
  }
}
