import { INestApplication, ValidationPipe } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import type { Express } from 'express';
import { json, urlencoded } from 'express';
import { auth } from './auth/auth';

// Shared between main.ts and the e2e tests so both run the same HTTP stack.
// Requires the app to be created with `bodyParser: false`: the better-auth
// handler must see the raw request, so parsers are re-added after its mount.
export function configureApp(app: INestApplication): void {
  const expressApp = app.getHttpAdapter().getInstance() as Express;
  expressApp.all('/api/v1/auth/{*any}', toNodeHandler(auth));

  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
}
