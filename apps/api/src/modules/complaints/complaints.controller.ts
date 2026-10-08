import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '@mess/shared';
import { CurrentAuth, CurrentMessId, RequireMess, RequirePermissions, StudentOnly } from '../../common/decorators/auth.decorators';
import type { RequestAuth } from '../../common/auth.types';
import { UuidParam } from '../../common/http/params';
import { ComplaintResponseDto, ComplaintStatusDto, CreateComplaintDto, ListComplaintsQueryDto, StudentComplaintsQueryDto } from './dto/complaint.dto';
import { ComplaintsService } from './complaints.service';

const ComplaintId = () => UuidParam('id', 'Complaint');

@ApiTags('complaints')
@Controller('complaints')
@RequireMess()
export class ComplaintsController {
  constructor(private readonly complaints: ComplaintsService) {}

  @Get()
  @RequirePermissions(Permission.COMPLAINT_VIEW)
  list(@CurrentMessId() messId: string, @Query() query: ListComplaintsQueryDto) {
    return this.complaints.list(messId, query);
  }

  @Get('counts')
  @RequirePermissions(Permission.COMPLAINT_VIEW)
  counts(@CurrentMessId() messId: string) {
    return this.complaints.counts(messId);
  }

  @Get(':id')
  @RequirePermissions(Permission.COMPLAINT_VIEW)
  detail(@CurrentMessId() messId: string, @ComplaintId() id: string) {
    return this.complaints.detail(messId, id);
  }

  @Patch(':id/status')
  @RequirePermissions(Permission.COMPLAINT_MANAGE)
  status(@CurrentAuth() auth: RequestAuth, @CurrentMessId() messId: string, @ComplaintId() id: string, @Body() dto: ComplaintStatusDto) {
    return this.complaints.setStatus(messId, auth.user.id, id, dto.status);
  }

  @Post(':id/responses')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.COMPLAINT_MANAGE)
  respond(@CurrentAuth() auth: RequestAuth, @CurrentMessId() messId: string, @ComplaintId() id: string, @Body() dto: ComplaintResponseDto) {
    return this.complaints.respond(messId, auth.user.id, id, dto);
  }
}

@ApiTags('complaints')
@Controller('students/me/complaints')
@StudentOnly()
@RequirePermissions(Permission.STUDENT_SELF)
export class StudentComplaintsController {
  constructor(private readonly complaints: ComplaintsService) {}

  @Get()
  mine(@CurrentAuth() auth: RequestAuth, @Query() query: StudentComplaintsQueryDto) {
    return this.complaints.listMine(auth.user, query);
  }

  @Post()
  create(@CurrentAuth() auth: RequestAuth, @Body() dto: CreateComplaintDto) {
    return this.complaints.create(auth.user, dto);
  }

  @Get(':id')
  detail(@CurrentAuth() auth: RequestAuth, @ComplaintId() id: string) {
    return this.complaints.studentDetail(auth.user, id);
  }
}
