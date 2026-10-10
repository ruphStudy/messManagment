import { Injectable } from '@nestjs/common';
import { cityStateError, DEFAULT_SERVING_TIMES, findCity, ErrorCode, isTimeRangeInvalid, MESSAGES, MessProfile, Role, servingTimeErrors, type MealServingTimes } from '@mess/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/http/app.exception';
import type { RequestAuth } from '../../common/auth.types';
import { CreateMessDto, UpdateMessDto } from './dto/mess.dto';
import { toMessProfile } from './mess.mapper';

type MealAndTimeFields = Pick<
  CreateMessDto,
  'breakfastAvailable' | 'lunchAvailable' | 'dinnerAvailable' | 'openingTime' | 'closingTime'
> &
  Partial<MealServingTimes>;

@Injectable()
export class MessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Creates the owner's mess and their MESS_OWNER membership in one transaction. */
  async create(auth: RequestAuth, dto: CreateMessDto): Promise<MessProfile> {
    if (auth.membership) {
      throw AppException.conflict('You have already set up a mess', undefined, ErrorCode.MESS_ALREADY_EXISTS);
    }
    this.assertBusinessRules(dto);
    dto.city = this.assertLocation(dto.state, dto.city);

    const mess = await this.prisma.$transaction(async (tx) => {
      const created = await tx.mess.create({ data: { ...dto, ownerId: auth.user.id } });
      await tx.messMembership.create({ data: { userId: auth.user.id, messId: created.id, role: Role.MESS_OWNER } });
      // New messes need a platform payment (or an admin-granted trial) before mess changes are allowed.
      await tx.platformSubscription.create({ data: { messId: created.id, status: 'PENDING_PAYMENT', planName: 'MessMate' } });
      return created;
    });
    return toMessProfile(mess);
  }

  async get(messId: string): Promise<MessProfile> {
    const mess = await this.prisma.mess.findUnique({ where: { id: messId } });
    if (!mess) throw AppException.notFound('Mess not found');
    return toMessProfile(mess);
  }

  async update(messId: string, dto: UpdateMessDto): Promise<MessProfile> {
    const current = await this.prisma.mess.findUnique({ where: { id: messId } });
    if (!current) throw AppException.notFound('Mess not found');
    this.assertBusinessRules({ ...current, ...dto });
    if (dto.city !== undefined || dto.state !== undefined) {
      dto.city = this.assertLocation(dto.state ?? current.state, dto.city ?? current.city, current);
    }

    const mess = await this.prisma.mess.update({ where: { id: messId }, data: dto });
    return toMessProfile(mess);
  }

  /**
   * City must belong to the state (bundled dataset). A mess saved before this rule keeps its old free-text city
   * while city and state stay unchanged. Returns the city in the dataset's spelling.
   */
  private assertLocation(state: string, city: string, saved?: { state: string; city: string }): string {
    const error = cityStateError(state, city, saved);
    if (error) throw AppException.validation({ city: [error] });
    return findCity(state, city) ?? city;
  }

  private assertBusinessRules(values: MealAndTimeFields) {
    const fields: Record<string, string[]> = {};
    if (!values.breakfastAvailable && !values.lunchAvailable && !values.dinnerAvailable) {
      fields.meals = [MESSAGES.mealRequired];
    }
    if (isTimeRangeInvalid(values.openingTime, values.closingTime)) fields.closingTime = [MESSAGES.timeOrder];
    const times = Object.fromEntries(
      (Object.keys(DEFAULT_SERVING_TIMES) as (keyof MealServingTimes)[]).map((k) => [k, values[k] ?? DEFAULT_SERVING_TIMES[k]]),
    ) as unknown as MealServingTimes;
    Object.assign(fields, servingTimeErrors(times));
    if (Object.keys(fields).length) throw AppException.validation(fields);
  }
}
