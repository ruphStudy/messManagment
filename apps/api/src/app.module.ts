import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { ConfigModule } from './config/config.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthController } from './modules/health/health.controller';
import { MessModule } from './modules/mess/mess.module';
import { PrismaModule } from './prisma/prisma.module';
import { StudentsModule } from './modules/students/students.module';
import { MealPlansModule } from './modules/meal-plans/meal-plans.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { MenusModule } from './modules/menus/menus.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    AuthModule,
    MessModule,
    StudentsModule,
    MealPlansModule,
    SubscriptionsModule,
    MenusModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: rate limit → authenticate → authorize.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
