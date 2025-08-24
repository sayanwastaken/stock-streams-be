import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
const compression = require('compression');
import {
  GlobalExceptionFilter,
  ValidationExceptionFilter,
  ResponseTransformInterceptor,
  LoggingInterceptor,
} from './common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(compression());
  app.enableCors({
    origin: '*', // as of now allows all origins
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    Credentials: true, // allow cookies
  });

  // Global validation pipe for dto validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties not in DTO
      forbidNonWhitelisted: true, // Throw error for non-whitelisted properties
      transform: true, // Transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Enable implicit type conversion
      },
    }),
  );

  // Global exception filters
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalFilters(new ValidationExceptionFilter());

  // Global interceptors
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalInterceptors(new ResponseTransformInterceptor());

  app.setGlobalPrefix('api'); // all routes will be prefixed with /api

  // Setup Swagger/OpenAPI documentation
  const config = new DocumentBuilder()
    .setTitle('Stream Stocks Backend API')
    .setDescription(
      'A comprehensive stock portfolio management API supporting NSE/BSE markets with Yahoo Finance integration for real-time prices, fundamentals, and WebSocket-based real-time updates. Features include portfolio analytics, sector breakdowns, exchange-wise performance tracking, and automated market data synchronization.',
    )
    .setVersion('1.0')
    .addTag(
      'portfolio',
      'Portfolio management operations including CRUD, analytics, and market data updates',
    )
    .addTag(
      'websockets',
      'Real-time WebSocket communication for live portfolio updates',
    )
    .addTag(
      'market-data',
      'Yahoo Finance integration for stock prices and fundamentals',
    )
    .addServer('http://localhost:5090', 'Development server')
    .addServer('https://example.streamstocks.com', 'Production server')
    .addBearerAuth() // for jwt auth
    .addApiKey() // for api key auth
    .build(); // build the swagger config

  const document = SwaggerModule.createDocument(app, config); // create the swagger document

  // setup the swagger module
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      docExpansion: 'list',
      defaultModelsExpandDepth: 2,
      defaultModelExpandDepth: 2,
      displayOperationId: true,
      tryItOutEnabled: true,
    },
    customSiteTitle: 'Stream Stocks Backend API Documentation',
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    customJs: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.min.js',
    ],
    customCssUrl: [
      'https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css',
    ],
  });

  await app.listen(configService.get('port') ?? 5090);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
