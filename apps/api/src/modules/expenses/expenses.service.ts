import { HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { businessToday, ErrorCode, ExpenseStatus, type Expense } from '@mess/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/http/app.exception';
import { fromDateString } from '../../common/http/dates';
import { Paginated } from '../../common/http/pagination';
import { CreateExpenseDto, ListExpensesQueryDto, UpdateExpenseDto } from './dto/expense.dto';
import { expenseInclude, toExpense } from './expense.mapper';
import { ExpenseCategoriesService } from './expense-categories.service';

/** Money spent by the mess. Never deleted: mistakes are reversed and drop out of every total. */
@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: ExpenseCategoriesService,
  ) {}

  async create(messId: string, userId: string, dto: CreateExpenseDto): Promise<Expense> {
    this.assertDate(dto.expenseDate);
    await this.categories.requireUsable(messId, dto.categoryId);
    const row = await this.prisma.expense.create({
      data: {
        messId,
        categoryId: dto.categoryId,
        title: dto.title,
        amountPaise: dto.amountPaise,
        expenseDate: fromDateString(dto.expenseDate),
        paymentMethod: dto.paymentMethod ?? null,
        vendorName: dto.vendorName ?? null,
        referenceNumber: dto.referenceNumber ?? null,
        note: dto.note ?? null,
        recordedById: userId,
      },
      include: expenseInclude,
    });
    return toExpense(row);
  }

  async update(messId: string, id: string, dto: UpdateExpenseDto): Promise<Expense> {
    const current = await this.prisma.expense.findFirst({ where: { id, messId }, select: { status: true, categoryId: true } });
    if (!current) throw this.notFound();
    if (current.status === ExpenseStatus.REVERSED) throw this.alreadyReversed('Reversed expenses cannot be edited');
    if (dto.expenseDate) this.assertDate(dto.expenseDate);
    // Keeping an expense in a category that was later turned off is fine; moving one into it is not.
    if (dto.categoryId) await this.categories.requireUsable(messId, dto.categoryId, dto.categoryId === current.categoryId);

    const { expenseDate, ...fields } = dto;
    // Only RECORDED rows are updated, so a concurrent reversal can't be overwritten.
    const { count } = await this.prisma.expense.updateMany({
      where: { id, messId, status: ExpenseStatus.RECORDED },
      data: { ...fields, ...(expenseDate ? { expenseDate: fromDateString(expenseDate) } : {}) },
    });
    if (count === 0) throw this.alreadyReversed('Reversed expenses cannot be edited');
    return this.get(messId, id);
  }

  async reverse(messId: string, userId: string, id: string, reason?: string): Promise<Expense> {
    const { count } = await this.prisma.expense.updateMany({
      where: { id, messId, status: ExpenseStatus.RECORDED },
      data: { status: ExpenseStatus.REVERSED, reversedAt: new Date(), reversedById: userId, reversalReason: reason ?? null },
    });
    if (count === 0) {
      const exists = await this.prisma.expense.count({ where: { id, messId } });
      throw exists ? this.alreadyReversed('This expense was already reversed') : this.notFound();
    }
    return this.get(messId, id);
  }

  async get(messId: string, id: string): Promise<Expense> {
    const row = await this.prisma.expense.findFirst({ where: { id, messId }, include: expenseInclude });
    if (!row) throw this.notFound();
    return toExpense(row);
  }

  private listWhere(messId: string, query: ListExpensesQueryDto): Prisma.ExpenseWhereInput {
    return {
      messId,
      categoryId: query.categoryId,
      status: query.status,
      paymentMethod: query.paymentMethod,
      expenseDate: { ...(query.from ? { gte: fromDateString(query.from) } : {}), ...(query.to ? { lte: fromDateString(query.to) } : {}) },
      ...(query.search ? { AND: this.searchTerms(query.search) } : {}),
    };
  }

  /** Spent in the filtered set: RECORDED only (reversed rows never count). */
  async recordedTotal(messId: string, query: ListExpensesQueryDto) {
    const where = this.listWhere(messId, query);
    const [sum, reversed] = await Promise.all([
      this.prisma.expense.aggregate({ where: { ...where, status: ExpenseStatus.RECORDED }, _sum: { amountPaise: true }, _count: { _all: true } }),
      this.prisma.expense.count({ where: { ...where, status: ExpenseStatus.REVERSED } }),
    ]);
    return { totalPaise: sum._sum.amountPaise ?? 0, recordedCount: sum._count._all, reversedCount: reversed };
  }

  async list(messId: string, query: ListExpensesQueryDto) {
    const where = this.listWhere(messId, query);
    const order = query.sortOrder ?? 'desc';
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        where,
        include: expenseInclude,
        orderBy: query.sortBy === 'amount' ? [{ amountPaise: order }, { createdAt: 'desc' }] : [{ expenseDate: order }, { createdAt: order }],
        skip: query.skip,
        take: query.pageSize,
      }),
      this.prisma.expense.count({ where }),
    ]);
    return new Paginated(rows.map(toExpense), total, query);
  }

  /** Every word must match title, vendor, note, reference or category name. */
  private searchTerms(search: string): Prisma.ExpenseWhereInput[] {
    return search
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 5)
      .map((term) => {
        const contains = { contains: term, mode: 'insensitive' as const };
        return {
          OR: [{ title: contains }, { vendorName: contains }, { note: contains }, { referenceNumber: contains }, { category: { name: contains } }],
        };
      });
  }

  /** Actual spending only: today or earlier (backdating is allowed). */
  private assertDate(date: string) {
    if (date > businessToday()) {
      throw new AppException(HttpStatus.BAD_REQUEST, ErrorCode.EXPENSE_DATE_INVALID, 'Expenses cannot be in the future', {
        expenseDate: ['Choose today or an earlier date'],
      });
    }
  }

  private alreadyReversed(message: string) {
    return new AppException(HttpStatus.CONFLICT, ErrorCode.EXPENSE_ALREADY_REVERSED, message);
  }

  private notFound() {
    return new AppException(HttpStatus.NOT_FOUND, ErrorCode.EXPENSE_NOT_FOUND, 'Expense not found');
  }
}
