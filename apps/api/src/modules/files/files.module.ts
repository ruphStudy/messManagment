import { Module } from '@nestjs/common';
import { APP_CONFIG, AppConfig } from '../../config/app-config';
import { StudentsModule } from '../students/students.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { LocalStorageProvider, STORAGE_PROVIDER } from './storage.provider';

@Module({
  imports: [StudentsModule],
  controllers: [FilesController],
  providers: [
    FilesService,
    { provide: STORAGE_PROVIDER, inject: [APP_CONFIG], useFactory: (c: AppConfig) => new LocalStorageProvider(c.uploadDir, c.isProduction) },
  ],
  exports: [FilesService],
})
export class FilesModule {}
