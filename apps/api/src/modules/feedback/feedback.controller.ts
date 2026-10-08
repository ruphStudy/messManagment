import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '@mess/shared';
import { CurrentAuth, CurrentMessId, RequireMess, RequirePermissions, StudentOnly } from '../../common/decorators/auth.decorators';
import type { RequestAuth } from '../../common/auth.types';
import { PaginationQueryDto } from '../../common/http/pagination';
import { GeneralFeedbackDto, ListFeedbackQueryDto, MealFeedbackDto, SummaryQueryDto } from './dto/feedback.dto';
import { FeedbackService } from './feedback.service';

@ApiTags('feedback')
@Controller('feedback')
@RequireMess()
export class FeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Get()
  @RequirePermissions(Permission.FEEDBACK_VIEW)
  list(@CurrentMessId() messId: string, @Query() query: ListFeedbackQueryDto) {
    return this.feedback.list(messId, query);
  }

  @Get('summary')
  @RequirePermissions(Permission.FEEDBACK_VIEW)
  summary(@CurrentMessId() messId: string, @Query() query: SummaryQueryDto) {
    return this.feedback.summary(messId, query.from, query.to);
  }
}

@ApiTags('feedback')
@Controller('students/me/feedback')
@StudentOnly()
@RequirePermissions(Permission.STUDENT_SELF)
export class StudentFeedbackController {
  constructor(private readonly feedback: FeedbackService) {}

  @Get()
  mine(@CurrentAuth() auth: RequestAuth, @Query() query: PaginationQueryDto) {
    return this.feedback.listMine(auth.user, query);
  }

  @Get('eligible-meals')
  eligible(@CurrentAuth() auth: RequestAuth) {
    return this.feedback.eligibleMeals(auth.user);
  }

  @Post('meal')
  meal(@CurrentAuth() auth: RequestAuth, @Body() dto: MealFeedbackDto) {
    return this.feedback.submitMeal(auth.user, dto);
  }

  @Post('general')
  general(@CurrentAuth() auth: RequestAuth, @Body() dto: GeneralFeedbackDto) {
    return this.feedback.submitGeneral(auth.user, dto);
  }
}
