import { Module } from '@nestjs/common';
import { StudentsModule } from '../students/students.module';
import { MealCountsService } from './meal-counts.service';
import { ExpectedMealsController, PausesController, StudentPausesController } from './pauses.controller';
import { PausesService } from './pauses.service';

@Module({
  imports: [StudentsModule],
  controllers: [PausesController, ExpectedMealsController, StudentPausesController],
  providers: [PausesService, MealCountsService],
  exports: [PausesService, MealCountsService],
})
export class PausesModule {}
