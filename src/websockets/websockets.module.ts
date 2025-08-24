import { Module } from '@nestjs/common';
import { PortfolioGateway } from './portfolio-gateway';
import { PortfolioWebSocketService } from './portfolio-websocket.service';

@Module({
  providers: [PortfolioGateway, PortfolioWebSocketService],
  exports: [PortfolioGateway, PortfolioWebSocketService],
})
export class WebsocketsModule {}
