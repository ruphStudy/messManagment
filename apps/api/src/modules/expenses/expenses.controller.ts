import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Permission } from '@mess/shared';
import { CurrentAuth, CurrentMessId, RequireMess, RequirePermissions } from '../../common/decorators/auth.decorators';
import type { RequestAuth } from '../../common/auth.types';
import { UuidParam } from '../../common/http/params';
import {
  CategoryListQueryDto,
  CreateCategoryDto,
  CreateExpenseDto,
  ExpenseRangeQueryDto,
  ListExpensesQueryDto,
  MonthQueryDto,
  ReverseExpenseDto,
  UpdateCategoryDto,
  UpdateExpenseDto,
} from './dto/expense.dto';
import { ExpenseCategoriesService } from './expense-categories.service';
import { ExpenseSummaryService } from './expense-summary.service';
import { ExpensesService } from './expenses.service';

const ExpenseId = () => UuidParam('id', 'Expense');

@ApiTags('expenses')
@Controller('expenses')
@RequireMess()
export class ExpensesController {
  constructor(
    private readonly expenses: ExpensesService,
    private readonly summaries: ExpenseSummaryService,
  ) {}

  @Get()
  @RequirePermissions(Permission.EXPENSE_VIEW)
  list(@CurrentMessId() messId: string, @Query() query: ListExpensesQueryDto) {
    return this.expenses.list(messId, query);
  }

  @Post()
  @RequirePermissions(Permission.EXPENSE_MANAGE)
  create(@CurrentAuth() auth: RequestAuth, @CurrentMessId() messId: string, @Body() dto: CreateExpenseDto) {
    return this.expenses.create(messId, auth.user.id, dto);
  }

  @Get('summary')
  @RequirePermissions(Permission.EXPENSE_VIEW)
  summary(@CurrentMessId() messId: string, @Query() query: ExpenseRangeQueryDto) {
    return this.summaries.summary(messId, query.from, query.to);
  }

  @Get('monthly/summary')
  @RequirePermissions(Permission.EXPENSE_VIEW)
  monthly(@CurrentMessId() messId: string, @Query() query: MonthQueryDto) {
    return this.summaries.monthly(messId, query.month);
  }

  @Get(':id')
  @RequirePermissions(Permission.EXPENSE_VIEW)
  get(@CurrentMessId() messId: string, @ExpenseId() id: string) {
    return this.expenses.get(messId, id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.EXPENSE_MANAGE)
  update(@CurrentMessId() messId: string, @ExpenseId() id: string, @Body() dto: UpdateExpenseDto) {
    return this.expenses.update(messId, id, dto);
  }

  @Post(':id/reverse')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions(Permission.EXPENSE_MANAGE)
  reverse(@CurrentAuth() auth: RequestAuth, @CurrentMessId() messId: string, @ExpenseId() id: string, @Body() dto: ReverseExpenseDto) {
    return this.expenses.reverse(messId, auth.user.id, id, dto.reason);
  }
}

@ApiTags('expenses')
@Controller('expense-categories')
@RequireMess()
export class ExpenseCategoriesController {
  constructor(private readonly categories: ExpenseCategoriesService) {}

  @Get()
  @RequirePermissions(Permission.EXPENSE_VIEW)
  list(@CurrentMessId() messId: string, @Query() query: CategoryListQueryDto) {
    return this.categories.list(messId, query.includeInactive === 'true');
  }

  @Post()
  @RequirePermissions(Permission.EXPENSE_MANAGE)
  create(@CurrentMessId() messId: string, @Body() dto: CreateCategoryDto) {
    return this.categories.create(messId, dto.name);
  }

  @Patch(':id')
  @RequirePermissions(Permission.EXPENSE_MANAGE)
  update(@CurrentMessId() messId: string, @UuidParam('id', 'Category') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(messId, id, dto);
  }
}

@ApiTags('finance')
@Controller('finance')
@RequireMess()
export class FinanceController {
  constructor(private readonly summaries: ExpenseSummaryService) {}

  /** Basic operating estimate (collected − expenses). Not accounting profit. */
  @Get('monthly-summary')
  @RequirePermissions(Permission.FINANCE_VIEW)
  monthly(@CurrentMessId() messId: string, @Query() query: MonthQueryDto) {
    return this.summaries.financeMonthly(messId, query.month);
  }
}
