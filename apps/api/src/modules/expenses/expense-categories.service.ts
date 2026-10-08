import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DEFAULT_EXPENSE_CATEGORIES, ErrorCode, ExpenseStatus, type ExpenseCategory } from '@mess/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/http/app.exception';

export const normalizeCategoryName = (name: string) => name.trim().toLowerCase();

/** Per-mess categories. Defaults are created idempotently on first use, so no setup step is needed. */
@Injectable()
export class ExpenseCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaults(messId: string) {
    const existing = await this.prisma.expenseCategory.count({ where: { messId } });
    if (existing) return;
    // skipDuplicates + the (messId, normalizedName) unique key make concurrent first uses safe.
    await this.prisma.expenseCategory.createMany({
      data: DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ messId, name, normalizedName: normalizeCategoryName(name) })),
      skipDuplicates: true,
    });
  }

  async list(messId: string, includeInactive: boolean): Promise<ExpenseCategory[]> {
    await this.ensureDefaults(messId);
    const rows = await this.prisma.expenseCategory.findMany({
      where: { messId, ...(includeInactive ? {} : { isActive: true }) },
      include: { _count: { select: { expenses: { where: { status: ExpenseStatus.RECORDED } } } } },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    return rows.map((r) => ({ id: r.id, name: r.name, isActive: r.isActive, expenseCount: r._count.expenses }));
  }

  async create(messId: string, name: string): Promise<ExpenseCategory> {
    await this.ensureDefaults(messId);
    try {
      const row = await this.prisma.expenseCategory.create({ data: { messId, name: name.trim(), normalizedName: normalizeCategoryName(name) } });
      return { id: row.id, name: row.name, isActive: row.isActive, expenseCount: 0 };
    } catch (error) {
      throw this.mapDuplicate(error);
    }
  }

  /** Rename or (de)activate. Categories are never deleted, so past expenses keep their category. */
  async update(messId: string, id: string, patch: { name?: string; isActive?: boolean }): Promise<ExpenseCategory> {
    const current = await this.prisma.expenseCategory.findFirst({ where: { id, messId }, select: { id: true } });
    if (!current) throw this.notFound();
    try {
      await this.prisma.expenseCategory.update({
        where: { id },
        data: {
          ...(patch.name !== undefined ? { name: patch.name.trim(), normalizedName: normalizeCategoryName(patch.name) } : {}),
          ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
        },
      });
    } catch (error) {
      throw this.mapDuplicate(error);
    }
    return (await this.list(messId, true)).find((c) => c.id === id)!;
  }

  /** A category of this mess that can be used for a new/changed expense. */
  async requireUsable(messId: string, id: string, allowInactive = false) {
    const category = await this.prisma.expenseCategory.findFirst({ where: { id, messId }, select: { isActive: true } });
    if (!category) throw this.notFound();
    if (!category.isActive && !allowInactive) {
      throw new AppException(HttpStatus.CONFLICT, ErrorCode.EXPENSE_CATEGORY_INACTIVE, 'This category is turned off. Choose another or turn it back on.', {
        categoryId: ['Category is inactive'],
      });
    }
  }

  private mapDuplicate(error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return new AppException(HttpStatus.CONFLICT, ErrorCode.EXPENSE_CATEGORY_EXISTS, 'A category with this name already exists', { name: ['Already exists'] });
    }
    return error;
  }

  private notFound() {
    return new AppException(HttpStatus.NOT_FOUND, ErrorCode.EXPENSE_CATEGORY_NOT_FOUND, 'Category not found', { categoryId: ['Category not found'] });
  }
}
