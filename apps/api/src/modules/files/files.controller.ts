import { Controller, Get, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ATTACHMENT_LIMITS, Permission } from '@mess/shared';
import { CurrentAuth, RequirePermissions, StudentOnly } from '../../common/decorators/auth.decorators';
import type { RequestAuth } from '../../common/auth.types';
import { UuidParam } from '../../common/http/params';
import { FilesService, type IncomingFile } from './files.service';

@ApiTags('files')
@ApiBearerAuth()
@Controller()
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post('students/me/uploads/complaint-photo')
  @StudentOnly()
  @RequirePermissions(Permission.STUDENT_SELF)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: ATTACHMENT_LIMITS.maxBytes, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  upload(@CurrentAuth() auth: RequestAuth, @UploadedFile() file?: IncomingFile) {
    return this.files.uploadComplaintPhoto(auth.user, file);
  }

  /** Authorized download (bearer token). Not cached by shared caches. */
  @Get('files/:id')
  async download(@CurrentAuth() auth: RequestAuth, @UuidParam('id', 'File') id: string, @Res() res: Response) {
    const { data, mimeType } = await this.files.read(auth, id);
    res.set({ 'Content-Type': mimeType, 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' });
    res.send(data);
  }
}
