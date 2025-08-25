import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Portfolio } from '../entities/portfolio.entity';
import { PortfolioService } from '../services/portfolio.service';
import { YahooFinanceService } from '../services/yahoo-finance.service';
import { PortfolioController } from '../controllers/portfolio.controller';
import { WebsocketsModule } from '../websockets/websockets.module';
import { RedisService } from '../services/redis.service';

@Module({
  imports: [TypeOrmModule.forFeature([Portfolio]), WebsocketsModule],
  controllers: [PortfolioController],
  providers: [PortfolioService, YahooFinanceService, RedisService],
  exports: [PortfolioService, YahooFinanceService],
})
export class PortfolioModule {}
