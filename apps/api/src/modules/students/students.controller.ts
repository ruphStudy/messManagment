import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Permission, STUDENT_IMPORT_LIMITS } from '@mess/shared';
import {
  CurrentAuth,
  CurrentMessId,
  RequireMess,
  RequirePermissions,
  StudentOnly,
} from '../../common/decorators/auth.decorators';
import type { RequestAuth } from '../../common/auth.types';
import { AppException } from '../../common/http/app.exception';
import {
  CreateStudentDto,
  ListStudentsQueryDto,
  UpdateStudentDto,
  UpdateStudentSelfDto,
  UpdateStudentStatusDto,
} from './dto/student.dto';
import { StudentImportService, type UploadedCsv } from './student-import.service';
import { StudentsService } from './students.service';

const StudentId = () => Param('id', new ParseUUIDPipe({ exceptionFactory: () => AppException.notFound('Student not found') }));

@ApiTags('students')
@Controller('students')
export class StudentsController {
  constructor(
    private readonly students: StudentsService,
    private readonly importer: StudentImportService,
  ) {}

  // ── Student self-service (declared before :id routes) ──

  @Get('me')
  @StudentOnly()
  @RequirePermissions(Permission.STUDENT_SELF)
  me(@CurrentAuth() auth: RequestAuth) {
    return this.students.getSelf(auth.user);
  }

  @Patch('me')
  @StudentOnly()
  @RequirePermissions(Permission.STUDENT_SELF)
  updateMe(@CurrentAuth() auth: RequestAuth, @Body() dto: UpdateStudentSelfDto) {
    return this.students.updateSelf(auth.user, dto);
  }

  // ── Mess team (tenant-scoped by @CurrentMessId) ──

  @Get()
  @RequireMess()
  @RequirePermissions(Permission.STUDENT_VIEW)
  list(@CurrentMessId() messId: string, @Query() query: ListStudentsQueryDto) {
    return this.students.list(messId, query);
  }

  @Post()
  @RequireMess()
  @RequirePermissions(Permission.STUDENT_MANAGE)
  create(@CurrentMessId() messId: string, @Body() dto: CreateStudentDto) {
    return this.students.create(messId, dto);
  }

  @Post('import')
  @RequireMess()
  @RequirePermissions(Permission.STUDENT_IMPORT)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: STUDENT_IMPORT_LIMITS.maxBytes, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  import(@CurrentMessId() messId: string, @UploadedFile() file?: UploadedCsv) {
    return this.importer.import(messId, file);
  }

  @Get(':id')
  @RequireMess()
  @RequirePermissions(Permission.STUDENT_VIEW)
  get(@CurrentMessId() messId: string, @StudentId() id: string) {
    return this.students.get(messId, id);
  }

  @Patch(':id')
  @RequireMess()
  @RequirePermissions(Permission.STUDENT_MANAGE)
  update(@CurrentMessId() messId: string, @StudentId() id: string, @Body() dto: UpdateStudentDto) {
    return this.students.update(messId, id, dto);
  }

  @Patch(':id/status')
  @RequireMess()
  @RequirePermissions(Permission.STUDENT_MANAGE)
  setStatus(@CurrentMessId() messId: string, @StudentId() id: string, @Body() dto: UpdateStudentStatusDto) {
    return this.students.setStatus(messId, id, dto.status);
  }

  @Post(':id/archive')
  @RequireMess()
  @RequirePermissions(Permission.STUDENT_ARCHIVE)
  archive(@CurrentMessId() messId: string, @StudentId() id: string) {
    return this.students.archive(messId, id);
  }

  @Post(':id/restore')
  @RequireMess()
  @RequirePermissions(Permission.STUDENT_ARCHIVE)
  restore(@CurrentMessId() messId: string, @StudentId() id: string) {
    return this.students.restore(messId, id);
  }
}
