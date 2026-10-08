import { Module } from '@nestjs/common';
import { StudentsModule } from '../students/students.module';
import { MenusController, StudentMenuController } from './menus.controller';
import { MenusService } from './menus.service';

@Module({
  imports: [StudentsModule],
  controllers: [MenusController, StudentMenuController],
  providers: [MenusService],
  exports: [MenusService],
})
export class MenusModule {}
