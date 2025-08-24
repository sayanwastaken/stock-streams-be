import { Injectable, Logger } from '@nestjs/common';
import {
  PortfolioGateway,
  PriceUpdateMessage,
  PortfolioUpdateMessage,
} from './portfolio-gateway';
import { Portfolio } from '../entities/portfolio.entity';

@Injectable()
export class PortfolioWebSocketService {
  private readonly logger = new Logger(PortfolioWebSocketService.name);

  constructor(private portfolioGateway: PortfolioGateway) {}

  /**
   * Broadcast price update when CMP is updated
   */
  async broadcastPriceUpdate(
    portfolioEntry: Portfolio,
    previousPrice?: number,
  ): Promise<void> {
    if (!this.portfolioGateway.hasConnectedClients()) {
      this.logger.debug('No connected clients, skipping price broadcast');
      return;
    }

    const change =
      previousPrice && portfolioEntry.currentPrice
        ? portfolioEntry.currentPrice - previousPrice
        : undefined;

    const changePercent =
      previousPrice && portfolioEntry.currentPrice && previousPrice > 0
        ? ((portfolioEntry.currentPrice - previousPrice) / previousPrice) * 100
        : undefined;

    const priceUpdate: PriceUpdateMessage = {
      type: 'price_update',
      portfolioEntryId: portfolioEntry.id,
      stockName: portfolioEntry.stockName,
      stockCode: portfolioEntry.stockCode,
      exchange: portfolioEntry.exchange,
      currentPrice: portfolioEntry.currentPrice,
      previousPrice,
      change,
      changePercent,
      timestamp: new Date(),
    };

    this.portfolioGateway.broadcastPriceUpdate(priceUpdate);
    this.logger.log(
      `Price update broadcasted: ${portfolioEntry.stockName} (${portfolioEntry.stockCode}) - ₹${portfolioEntry.currentPrice}`,
    );
  }

  /**
   * Broadcast when a new portfolio entry is added
   */
  async broadcastPortfolioEntryAdded(portfolioEntry: Portfolio): Promise<void> {
    if (!this.portfolioGateway.hasConnectedClients()) {
      return;
    }

    const portfolioUpdate: PortfolioUpdateMessage = {
      type: 'portfolio_update',
      action: 'entry_added',
      portfolioEntryId: portfolioEntry.id,
      stockName: portfolioEntry.stockName,
      stockCode: portfolioEntry.stockCode,
      exchange: portfolioEntry.exchange,
      data: {
        quantity: portfolioEntry.quantity,
        purchasePrice: portfolioEntry.purchasePrice,
        investmentAmount: portfolioEntry.investmentAmount,
        currentPrice: portfolioEntry.currentPrice,
        presentValue: portfolioEntry.presentValue,
        gainLossAmount: portfolioEntry.gainLossAmount,
        gainLossPercentage: portfolioEntry.gainLossPercentage,
      },
    };

    this.portfolioGateway.broadcastPortfolioUpdate(portfolioUpdate);
    this.logger.log(
      `Portfolio entry added broadcast: ${portfolioEntry.stockName}`,
    );
  }

  /**
   * Broadcast when a portfolio entry is updated
   */
  async broadcastPortfolioEntryUpdated(
    portfolioEntry: Portfolio,
  ): Promise<void> {
    if (!this.portfolioGateway.hasConnectedClients()) {
      return;
    }

    const portfolioUpdate: PortfolioUpdateMessage = {
      type: 'portfolio_update',
      action: 'entry_updated',
      portfolioEntryId: portfolioEntry.id,
      stockName: portfolioEntry.stockName,
      stockCode: portfolioEntry.stockCode,
      exchange: portfolioEntry.exchange,
      data: {
        quantity: portfolioEntry.quantity,
        purchasePrice: portfolioEntry.purchasePrice,
        investmentAmount: portfolioEntry.investmentAmount,
        currentPrice: portfolioEntry.currentPrice,
        presentValue: portfolioEntry.presentValue,
        gainLossAmount: portfolioEntry.gainLossAmount,
        gainLossPercentage: portfolioEntry.gainLossPercentage,
      },
    };

    this.portfolioGateway.broadcastPortfolioUpdate(portfolioUpdate);
    this.logger.log(
      `Portfolio entry updated broadcast: ${portfolioEntry.stockName}`,
    );
  }

  /**
   * Broadcast when a portfolio entry is deleted
   */
  async broadcastPortfolioEntryDeleted(
    portfolioEntry: Portfolio,
  ): Promise<void> {
    if (!this.portfolioGateway.hasConnectedClients()) {
      return;
    }

    const portfolioUpdate: PortfolioUpdateMessage = {
      type: 'portfolio_update',
      action: 'entry_deleted',
      portfolioEntryId: portfolioEntry.id,
      stockName: portfolioEntry.stockName,
      stockCode: portfolioEntry.stockCode,
      exchange: portfolioEntry.exchange,
    };

    this.portfolioGateway.broadcastPortfolioUpdate(portfolioUpdate);
    this.logger.log(
      `Portfolio entry deleted broadcast: ${portfolioEntry.stockName}`,
    );
  }

  /**
   * Broadcast bulk price updates (for batch updates)
   */
  async broadcastBulkPriceUpdates(
    priceUpdates: Array<{ portfolioEntry: Portfolio; previousPrice?: number }>,
  ): Promise<void> {
    if (
      !this.portfolioGateway.hasConnectedClients() ||
      priceUpdates.length === 0
    ) {
      return;
    }

    // Send individual price updates for each entry
    for (const { portfolioEntry, previousPrice } of priceUpdates) {
      await this.broadcastPriceUpdate(portfolioEntry, previousPrice);

      // Small delay to avoid overwhelming clients
      if (priceUpdates.length > 10) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    this.logger.log(
      `Bulk price updates broadcasted: ${priceUpdates.length} entries`,
    );
  }

  /**
   * Send system notification to all clients
   */
  async broadcastSystemNotification(
    message: string,
    data?: any,
  ): Promise<void> {
    if (!this.portfolioGateway.hasConnectedClients()) {
      return;
    }

    this.portfolioGateway.broadcastSystemMessage(message, data);
    this.logger.log(`System notification broadcasted: ${message}`);
  }

  /**
   * Get WebSocket connection statistics
   */
  getConnectionStats(): {
    connectedClients: number;
    hasConnectedClients: boolean;
  } {
    return {
      connectedClients: this.portfolioGateway.getConnectedClientsCount(),
      hasConnectedClients: this.portfolioGateway.hasConnectedClients(),
    };
  }
}
