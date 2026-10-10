import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { API_PREFIX } from '@mess/shared';
import { AppModule } from './app.module';
import { createValidationPipe } from './common/http/validation';
import { studentMessContextMiddleware } from './common/http/student-mess-context';
import { APP_CONFIG, AppConfig } from './config/app-config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<AppConfig>(APP_CONFIG);

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cookieParser());
  // Student multi-mess: x-mess-id selection for the rest of the request (verified per request).
  app.use(studentMessContextMiddleware);
  app.enableCors({ origin: config.corsOrigins, credentials: true });
  app.setGlobalPrefix(API_PREFIX.slice(1));
  app.useGlobalPipes(createValidationPipe());
  app.enableShutdownHooks();

  if (!config.isProduction) {
    const doc = new DocumentBuilder().setTitle('Mess Management API').setVersion('1').addBearerAuth().build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, doc));
  }

  await app.listen(config.port);
  Logger.log(`API listening on http://localhost:${config.port}${API_PREFIX}`, 'Bootstrap');
}

void bootstrap();
