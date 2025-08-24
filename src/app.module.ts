import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

//nestjs module imports
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';

//local imports
import config from './config/config';
import { Portfolio } from './entities';
import { PortfolioModule } from './modules/portfolio.module';
import { WebsocketsModule } from './websockets/websockets.module';

@Module({
  imports: [
    //env config module
    ConfigModule.forRoot({
      isGlobal: true,
      load: [config],
    }),

    // for rate limiting
    ThrottlerModule.forRoot({
      throttlers: [
        {
          limit: 100,
          ttl: 60,
          blockDuration: 60, // in seconds
        },
      ],
    }),

    //database module
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        entities: [Portfolio],
        synchronize: true, // Auto-create tables from entities
      }),
    }),

    // WebSocket module for real-time updates
    WebsocketsModule,

    // Portfolio module (simplified single module)
    PortfolioModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
