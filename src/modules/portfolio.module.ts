import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Portfolio } from '../entities/portfolio.entity';
import { PortfolioService } from '../services/portfolio.service';
import { YahooFinanceService } from '../services/yahoo-finance.service';
import { PortfolioController } from '../controllers/portfolio.controller';
import { WebsocketsModule } from '../websockets/websockets.module';

@Module({
  imports: [TypeOrmModule.forFeature([Portfolio]), WebsocketsModule],
  controllers: [PortfolioController],
  providers: [PortfolioService, YahooFinanceService],
  exports: [PortfolioService, YahooFinanceService],
})
export class PortfolioModule {}
