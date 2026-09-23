import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { json } from 'express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { EnvironmentVariables } from './common/config/environment-variables';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(ConfigService<EnvironmentVariables, true>);

  app.setGlobalPrefix('api');

  app.use((req: Request, res: Response, next: NextFunction) =>
    req.originalUrl.startsWith('/api/auth')
      ? next()
      : json({ limit: '1mb' })(req, res, next),
  );

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          scriptSrcAttr: ["'none'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https://images.unsplash.com'],
          connectSrc: ["'self'", 'https://get.geojs.io', 'https://api.open-meteo.com'],
          frameSrc: ['https://open.spotify.com'],
          mediaSrc: [
            "'self'",
            'https://raw.githubusercontent.com',
            'https://actions.google.com',
          ],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
        },
      },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.listen(config.get('PORT', { infer: true }));
}

void bootstrap();
