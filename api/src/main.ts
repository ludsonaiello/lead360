import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();


  app.enableCors({
    origin: [
      'https://app.lead360.app',
      /\.lead360\.app$/,
    ],
    credentials: true,
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 8000;
  await app.listen(port, '127.0.0.1');

  console.log(`API running on http://127.0.0.1:${port}`);
}
bootstrap();
