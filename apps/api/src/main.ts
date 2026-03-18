import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';

const env = loadEnv();
const app = await NestFactory.create(AppModule);

app.use(helmet());
app.use(cookieParser());
app.enableCors({
  origin: env.CORS_ORIGIN.split(','),
  credentials: true,
  maxAge: 86400,
});
app.setGlobalPrefix('v1');
await app.listen(env.PORT);
