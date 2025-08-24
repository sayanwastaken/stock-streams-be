# Stock Streams Backend

A comprehensive stock portfolio management backend API built with NestJS, featuring real-time market data integration, WebSocket support, and PostgreSQL database management.

## Overview

This backend service provides a complete solution for managing stock portfolios with support for NSE/BSE markets. It integrates with Yahoo Finance for real-time price updates and fundamental data, offers WebSocket-based real-time updates, and includes comprehensive portfolio analytics and reporting.

## Features

- **Portfolio Management**: Add, update, and remove stock entries with comprehensive tracking
- **Real-time Market Data**: Integration with Yahoo Finance for live stock prices and fundamentals
- **WebSocket Support**: Real-time portfolio updates and price notifications
- **Multi-exchange Support**: NSE and BSE market support
- **Sector Analysis**: Portfolio breakdown by sector with performance metrics
- **Performance Tracking**: Calculate gains/losses, present values, and investment returns
- **Rate Limiting**: Built-in API rate limiting and throttling
- **Validation**: Comprehensive input validation and error handling
- **Swagger Documentation**: Interactive API documentation

## Technology Stack

- **Framework**: NestJS 11.x
- **Language**: TypeScript 5.x
- **Database**: PostgreSQL with TypeORM
- **Cache/Queue**: Redis
- **Real-time**: Socket.io with WebSocket support
- **Validation**: class-validator and class-transformer
- **Documentation**: Swagger/OpenAPI
- **Testing**: Jest
- **Containerization**: Docker and Docker Compose

## Project Structure

```
src/
├── app.module.ts                 # Main application module
├── main.ts                      # Application bootstrap
├── config/
│   └── config.ts                # Configuration management
├── common/                      # Shared utilities
│   ├── filters/                 # Exception filters
│   └── interceptors/            # Request/response interceptors
├── controllers/
│   └── portfolio.controller.ts   # Portfolio API endpoints
├── dto/                         # Data transfer objects
│   ├── create-portfolio-entry.dto.ts
│   ├── update-portfolio-entry.dto.ts
│   └── portfolio-query.dto.ts
├── entities/                     # Database entities
│   └── portfolio.entity.ts       # Portfolio data model
├── modules/
│   └── portfolio.module.ts       # Portfolio feature module
├── services/                     # Business logic
│   ├── portfolio.service.ts      # Portfolio operations
│   └── yahoo-finance.service.ts  # Market data integration
└── websockets/                   # Real-time communication
    ├── portfolio-gateway.ts      # WebSocket event handling
    ├── portfolio-websocket.service.ts
    └── websockets.module.ts
```

## Installation and Setup

### Prerequisites

- Node.js 18+
- PostgreSQL 12+
- Redis 6+
- Docker and Docker Compose (optional)

### Environment Variables

Create a `.env` file in the root directory:

```env
# Application
NODE_ENV=development
PORT=5090

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=stock_streams_db
DATABASE_URL=postgres://user:password@localhost:5432/stock_streams_db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
REDIS_DB=0

# Rate Limiting
RATE_LIMIT_TTL=60
RATE_LIMIT_LIMIT=100
```

### Local Development

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Start PostgreSQL and Redis**:

   ```bash
   # Using Docker
   docker-compose -f docker-compose.dev.yml up redis

   # Or start services manually
   ```

3. **Run database migrations** (TypeORM auto-sync enabled in dev):

   ```bash
   # Database tables will be created automatically
   ```

4. **Start the application**:
   ```bash
   npm run start:dev
   ```

### Docker Development

```bash
# Start all services
docker-compose -f docker-compose.dev.yml up

# Start only specific services
docker-compose -f docker-compose.dev.yml up redis api
```

### Production Deployment

```bash
# Build and start production containers
docker-compose up --build

# Or use production Dockerfile
docker build -t stream-stocks-be .
```

## API Endpoints

### Portfolio Management

- `POST /api/portfolio` - Add new stock to portfolio
- `GET /api/portfolio` - Get all portfolio entries with filtering
- `GET /api/portfolio/:id` - Get specific portfolio entry
- `PATCH /api/portfolio/:id` - Update portfolio entry
- `DELETE /api/portfolio/:id` - Remove stock from portfolio

### Portfolio Analytics

- `GET /api/portfolio/summary` - Get overall portfolio performance
- `GET /api/portfolio/by-exchange` - Portfolio breakdown by exchange
- `GET /api/portfolio/by-sector` - Portfolio breakdown by sector

### Market Data

- `POST /api/portfolio/update-all-prices` - Update all stock prices
- `POST /api/portfolio/:id/update-market-data` - Update specific stock data

### WebSocket Status

- `GET /api/portfolio/websocket-status` - Get WebSocket connection status

## WebSocket Events

### Client to Server

- `subscribe_portfolio` - Subscribe to portfolio updates
- `unsubscribe_portfolio` - Unsubscribe from portfolio updates

### Server to Client

- `connection_status` - Connection confirmation
- `subscription_confirmed` - Subscription status
- `portfolio_update` - Portfolio changes (add/update/delete)
- `price_update` - Real-time price updates

## Data Models

### Portfolio Entity

The core data model includes:

- **Stock Information**: Name, code, exchange (NSE/BSE), sector
- **Investment Details**: Quantity, purchase price, investment amount
- **Market Data**: Current price, price update timestamp
- **Calculated Fields**: Present value, gain/loss amount and percentage
- **Fundamentals**: P/E ratio, EPS, fundamentals update timestamp
- **Metadata**: Notes, creation and update timestamps

### Supported Sectors

Financial Services, Information Technology, Consumer Goods, Healthcare, Energy, Automobiles, Telecommunications, Banking, Metals, Chemicals, Textiles, Cement, Power, Real Estate, Media, FMCG, Infrastructure, Oil and Gas, Pharmaceuticals, Agriculture, Other

## Configuration

### Database Configuration

- **Type**: PostgreSQL
- **Synchronization**: Auto-sync enabled in development (disable in production)
- **Entities**: Portfolio entity with calculated columns

### Rate Limiting

- **Default**: 100 requests per minute
- **Window**: 60 seconds
- **Block Duration**: 60 seconds after limit exceeded

### WebSocket Configuration

- **Namespace**: `/portfolio`
- **CORS**: Enabled for all origins
- **Redis Adapter**: For horizontal scaling

## Development Commands

```bash
# Development
npm run start:dev          # Start with hot reload
npm run start:debug        # Start with debug mode

# Building
npm run build              # Build for production
npm run start:prod         # Start production build

# Testing
npm run test               # Run unit tests
npm run test:watch         # Run tests in watch mode
npm run test:e2e           # Run end-to-end tests
npm run test:cov           # Run tests with coverage

# Code Quality
npm run lint               # Run ESLint
npm run format             # Format code with Prettier
```

## Testing

The project includes comprehensive testing setup:

- **Unit Tests**: Jest-based testing for services and controllers
- **E2E Tests**: End-to-end API testing
- **Test Coverage**: Coverage reporting enabled
- **Test Environment**: Node.js test environment

## Error Handling

- **Global Exception Filter**: Catches and formats all exceptions
- **Validation Filter**: Handles validation errors
- **Response Transform**: Standardizes API responses
- **Logging Interceptor**: Logs all requests and responses

## Security Features

- **Input Validation**: Comprehensive DTO validation
- **Rate Limiting**: API throttling to prevent abuse
- **CORS Configuration**: Configurable cross-origin settings
- **Data Sanitization**: Whitelist-based property filtering

## Monitoring and Logging

- **Request Logging**: All API requests logged with timing
- **Error Logging**: Comprehensive error tracking
- **Performance Metrics**: Request duration tracking
- **WebSocket Monitoring**: Connection statistics and status

## Deployment Considerations

### Production Settings

- Disable database auto-synchronization
- Set appropriate rate limiting values
- Configure CORS origins properly
- Use environment-specific configurations
- Enable proper logging levels

### Scaling

- Redis for WebSocket scaling
- Database connection pooling
- Load balancer configuration
- Health check endpoints

## Contributing

1. Follow the existing code structure and patterns
2. Add comprehensive tests for new features
3. Update documentation for API changes
4. Follow TypeScript and NestJS best practices
5. Use proper error handling and validation

## License

This project is unlicensed and proprietary.

## Support

For issues and questions, please refer to the project documentation or contact the development team.
