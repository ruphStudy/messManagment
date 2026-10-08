import { Injectable } from '@nestjs/common';
import {
  daysBetween,
  EXPENSE_LIMITS,
  ExpenseStatus,
  PaymentTransactionStatus,
  type ExpenseSummary,
  type FinanceMonthlySummary,
} from '@mess/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/http/app.exception';
import { fromDateString, monthRange, toDateString } from '../../common/http/dates';
import { PaymentsService } from '../payments/payments.service';

/**
 * All expense/finance totals in one place. Only RECORDED expenses and RECORDED payments ever count;
 * reversed rows stay in history but are excluded here. Aggregation runs in SQL (groupBy / aggregate).
 */
@Injectable()
export class ExpenseSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  /** Totals, category breakdown and per-day totals for [from, to] (a single day or a month). */
  async summary(messId: string, from: string, to: string): Promise<ExpenseSummary> {
    const span = daysBetween(from, to) + 1;
    if (span < 1 || span > EXPENSE_LIMITS.rangeDays) throw AppException.validation({ to: ['Choose a valid date range'] });
    const where = { messId, status: ExpenseStatus.RECORDED, expenseDate: { gte: fromDateString(from), lte: fromDateString(to) } };

    const [byCategory, byDay, totals] = await Promise.all([
      this.prisma.expense.groupBy({ by: ['categoryId'], where, _sum: { amountPaise: true }, _count: { _all: true } }),
      this.prisma.expense.groupBy({ by: ['expenseDate'], where, _sum: { amountPaise: true }, orderBy: { expenseDate: 'asc' } }),
      this.prisma.expense.aggregate({ where, _sum: { amountPaise: true }, _count: { _all: true } }),
    ]);
    const names = await this.prisma.expenseCategory.findMany({
      where: { id: { in: byCategory.map((c) => c.categoryId) } },
      select: { id: true, name: true },
    });

    return {
      from,
      to,
      totalPaise: totals._sum.amountPaise ?? 0,
      count: totals._count._all,
      categories: byCategory
        .map((c) => ({
          categoryId: c.categoryId,
          name: names.find((n) => n.id === c.categoryId)?.name ?? 'Other',
          totalPaise: c._sum.amountPaise ?? 0,
          count: c._count._all,
        }))
        .sort((a, b) => b.totalPaise - a.totalPaise),
      daily: byDay.map((d) => ({ date: toDateString(d.expenseDate), totalPaise: d._sum.amountPaise ?? 0 })),
    };
  }

  monthly(messId: string, month: string) {
    const { start, end } = monthRange(month);
    return this.summary(messId, start, end);
  }

  /** Basic operating estimate: collected payments − recorded expenses for the month. Dues are reported separately, never as revenue. */
  async financeMonthly(messId: string, month: string): Promise<FinanceMonthlySummary> {
    const { start, end } = monthRange(month);
    const dateRange = { gte: fromDateString(start), lte: fromDateString(end) };
    const [collected, spent, dashboard] = await Promise.all([
      this.prisma.payment.aggregate({ where: { messId, status: PaymentTransactionStatus.RECORDED, paymentDate: dateRange }, _sum: { amountPaise: true } }),
      this.prisma.expense.aggregate({ where: { messId, status: ExpenseStatus.RECORDED, expenseDate: dateRange }, _sum: { amountPaise: true } }),
      this.payments.dashboard(messId),
    ]);
    const collectedPaise = collected._sum.amountPaise ?? 0;
    const expensesPaise = spent._sum.amountPaise ?? 0;
    return { month, collectedPaise, expensesPaise, netPaise: collectedPaise - expensesPaise, pendingDuesPaise: dashboard.pendingDuesPaise };
  }
}

