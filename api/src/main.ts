import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { RedisClientService } from './core/redis/redis.client';
import * as bodyParser from 'body-parser';
import session from 'express-session';
import RedisStore from 'connect-redis';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  // Trust proxy (Nginx) - required for correct IP address from X-Forwarded-For
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', true);

  // ============================================
  // SESSION MIDDLEWARE (Sprint 11: Google OAuth Fix)
  // ============================================
  // Get Redis client from DI container
  const redisClientService = app.get(RedisClientService);
  const redisClient = redisClientService.getClient();

  // Configure Redis session store
  const redisStore = new RedisStore({
    client: redisClient,
    prefix: 'sess:', // Key prefix for session data
    ttl: 600, // 10 minutes (OAuth flow timeout)
  });

  // Configure session middleware (MUST be before body parser)
  app.use(
    session({
      store: redisStore,
      secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'fallback-secret-change-in-production', // Fallback to JWT secret
      resave: false, // Don't save session if unmodified
      saveUninitialized: false, // Don't create session until something stored
      name: 'lead360.sid', // Custom cookie name
      cookie: {
        httpOnly: true, // Prevent XSS attacks
        secure: process.env.NODE_ENV === 'production', // HTTPS only in production
        sameSite: 'lax', // CSRF protection (allows OAuth redirects)
        maxAge: 600000, // 10 minutes (600,000 ms)
        domain: process.env.NODE_ENV === 'production' ? '.lead360.app' : undefined, // Cross-subdomain
        path: '/', // Available on all routes
      },
    }),
  );

  logger.log('Session middleware configured with Redis store');

  // Add raw body parsing middleware for webhook signature verification
  // This must be added AFTER session middleware
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
      'http://localhost:8000', // Development
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

  // Setup graceful shutdown handlers
  setupGracefulShutdown(app);

  console.log(`API running on http://127.0.0.1:${port}`);
  console.log(`Swagger docs at http://127.0.0.1:${port}/api/docs`);
}

/**
 * Setup graceful shutdown handlers for SIGTERM, SIGINT, and uncaught exceptions
 *
 * This ensures:
 * - Puppeteer browser is properly closed
 * - Database connections are closed
 * - Background jobs are stopped
 * - Active requests are completed (with timeout)
 */
function setupGracefulShutdown(app: any) {
  let isShuttingDown = false;

  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) {
      logger.warn(`${signal} received again, forcing exit...`);
      process.exit(1);
    }

    isShuttingDown = true;
    logger.log(`${signal} received: starting graceful shutdown...`);

    // Set a timeout to force exit if shutdown takes too long
    const shutdownTimeout = setTimeout(() => {
      logger.error(
        'Graceful shutdown timeout (30s) - forcing exit',
      );
      process.exit(1);
    }, 30000); // 30 seconds

    try {
      // Close NestJS app (triggers onModuleDestroy hooks)
      await app.close();
      clearTimeout(shutdownTimeout);
      logger.log('Graceful shutdown completed successfully');
      process.exit(0);
    } catch (error) {
      clearTimeout(shutdownTimeout);
      logger.error(`Error during graceful shutdown: ${error.message}`);
      process.exit(1);
    }
  };

  // Handle SIGTERM (sent by process managers like PM2, Docker, systemd)
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    logger.error('Uncaught exception:', error);
    await gracefulShutdown('UNCAUGHT_EXCEPTION');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    // Don't exit on unhandled rejection, just log it
  });

  logger.log('Graceful shutdown handlers registered');
}

bootstrap();
