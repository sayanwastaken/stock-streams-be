import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

export interface PriceUpdateMessage {
  type: 'price_update';
  portfolioEntryId: string;
  stockName: string;
  stockCode: string;
  exchange: string;
  currentPrice: number;
  previousPrice?: number;
  change?: number;
  changePercent?: number;
  timestamp: Date;
}

export interface PortfolioUpdateMessage {
  type: 'portfolio_update';
  action: 'entry_added' | 'entry_updated' | 'entry_deleted';
  portfolioEntryId: string;
  stockName?: string;
  stockCode?: string;
  exchange?: string;
  data?: any;
}

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  namespace: '/portfolio',
})
export class PortfolioGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('PortfolioGateway');
  private connectedClients = new Set<string>();

  afterInit(server: Server) {
    this.logger.log('Portfolio WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.connectedClients.add(client.id);

    // Send welcome message with current connection count
    client.emit('connection_status', {
      status: 'connected',
      clientId: client.id,
      connectedClients: this.connectedClients.size,
      timestamp: new Date(),
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  @SubscribeMessage('subscribe_portfolio')
  handleSubscribePortfolio(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { clientInfo?: any },
  ) {
    this.logger.log(`Client ${client.id} subscribed to portfolio updates`);

    // Join the portfolio room for updates
    client.join('portfolio_updates');

    client.emit('subscription_confirmed', {
      type: 'portfolio_subscription',
      status: 'subscribed',
      timestamp: new Date(),
    });
  }

  @SubscribeMessage('unsubscribe_portfolio')
  handleUnsubscribePortfolio(@ConnectedSocket() client: Socket) {
    this.logger.log(`Client ${client.id} unsubscribed from portfolio updates`);

    // Leave the portfolio room
    client.leave('portfolio_updates');

    client.emit('subscription_confirmed', {
      type: 'portfolio_subscription',
      status: 'unsubscribed',
      timestamp: new Date(),
    });
  }

  @SubscribeMessage('ping')
  handlePing(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { timestamp?: number },
  ) {
    client.emit('pong', {
      timestamp: data.timestamp || Date.now(),
      serverTime: Date.now(),
    });
  }

  @SubscribeMessage('get_status')
  handleGetStatus(@ConnectedSocket() client: Socket) {
    client.emit('status_update', {
      connectedClients: this.connectedClients.size,
      rooms: Array.from(client.rooms),
      timestamp: new Date(),
    });
  }

  /**
   * Broadcast price update to all subscribed clients
   */
  broadcastPriceUpdate(priceUpdate: PriceUpdateMessage) {
    this.server.to('portfolio_updates').emit('price-update', priceUpdate);
    this.logger.debug(
      `Broadcasted price update for ${priceUpdate.stockName}: ${priceUpdate.currentPrice}`,
    );
  }

  /**
   * Broadcast portfolio update to all subscribed clients
   */
  broadcastPortfolioUpdate(portfolioUpdate: PortfolioUpdateMessage) {
    // Map the action to the correct event name
    let eventName: string;
    switch (portfolioUpdate.action) {
      case 'entry_added':
        eventName = 'portfolio-entry-added';
        break;
      case 'entry_updated':
        eventName = 'portfolio-entry-updated';
        break;
      case 'entry_deleted':
        eventName = 'portfolio-entry-deleted';
        break;
      default:
        eventName = 'portfolio-update';
    }

    this.server.to('portfolio_updates').emit(eventName, portfolioUpdate);
    this.logger.debug(
      `Broadcasted portfolio update: ${portfolioUpdate.action} for ${portfolioUpdate.stockName}`,
    );
  }

  /**
   * Send price update to specific client
   */
  sendPriceUpdateToClient(clientId: string, priceUpdate: PriceUpdateMessage) {
    this.server.to(clientId).emit('price-update', priceUpdate);
  }

  /**
   * Send portfolio update to specific client
   */
  sendPortfolioUpdateToClient(
    clientId: string,
    portfolioUpdate: PortfolioUpdateMessage,
  ) {
    this.server.to(clientId).emit('portfolio-update', portfolioUpdate);
  }

  /**
   * Get connected clients count
   */
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Check if any clients are connected
   */
  hasConnectedClients(): boolean {
    return this.connectedClients.size > 0;
  }

  /**
   * Broadcast system message to all clients
   */
  broadcastSystemMessage(message: string, data?: any) {
    this.server.emit('system_message', {
      message,
      data,
      timestamp: new Date(),
    });
  }
}
