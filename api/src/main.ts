import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  // Trust proxy (Nginx) - required for correct IP address from X-Forwarded-For
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', true);

  // Add raw body parsing middleware for webhook signature verification
  // This must be added BEFORE the JSON body parser
  app.use(
    bodyParser.json({
      verify: (req: any, res, buf, encoding) => {
        // Store raw body Buffer for webhook signature verification
        // CRITICAL: SendGrid and LiveKit signature verification require raw Buffer, not string
        if (
          req.url &&
          (req.url.includes('/webhooks/communication/') ||
            req.url.includes('/webhooks/voice-ai/'))
        ) {
          req.rawBody = buf; // Store as Buffer, not string!
        }
      },
    }),
  );

  // Global logging interceptor (logs RAW request BEFORE validation)
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Global exception filters (order matters - HttpExceptionFilter runs first)
  app.useGlobalFilters(
    new HttpExceptionFilter(), // Handles HttpException with validation errors
    new GlobalExceptionFilter(), // Catches all other exceptions
  );

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties not in DTO
      forbidNonWhitelisted: true, // Throw error for unknown properties
      transform: true, // Transform payloads to DTO instances (explicit transforms only)
    }),
  );

  // CORS configuration
  app.enableCors({
    origin: [
      'https://app.lead360.app',
      /\.lead360\.app$/,
      'http://localhost:3000', // Development
    ],
    credentials: true,
  });

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Lead360 API')
    .setDescription('Lead360 Platform API Documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Authentication', 'User authentication and session management')
    .addTag('Health', 'Health check endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ? Number(process.env.PORT) : 8000;
  await app.listen(port, '127.0.0.1');

  console.log(`API running on http://127.0.0.1:${port}`);
  console.log(`Swagger docs at http://127.0.0.1:${port}/api/docs`);
}
bootstrap();
