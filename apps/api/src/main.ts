import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { env } from './config/env.js';
import { configureApp } from './configure-app.js';

// rawBody: Webhooks der Anbindungen prüfen die Signatur über den Rohinhalt (IN-01)
const app = await NestFactory.create(AppModule, { rawBody: true });
configureApp(app);
await app.listen(env.PORT);
console.log(`API läuft auf http://localhost:${env.PORT}`);
