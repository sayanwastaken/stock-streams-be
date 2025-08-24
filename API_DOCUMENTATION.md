# Stream Stocks Backend API Documentation

This document provides comprehensive information about the Stream Stocks Backend API, including detailed endpoint descriptions, request/response examples, and integration guidelines.

## Table of Contents

1. [Authentication & Rate Limiting](#authentication--rate-limiting)
2. [Base URL & Endpoints](#base-url--endpoints)
3. [Portfolio Management API](#portfolio-management-api)
4. [Portfolio Analytics API](#portfolio-analytics-api)
5. [Market Data API](#market-data-api)
6. [WebSocket API](#websocket-api)
7. [Error Handling](#error-handling)
8. [Data Models](#data-models)
9. [Integration Examples](#integration-examples)

## Authentication & Rate Limiting

### Rate Limiting

- **Limit**: 100 requests per minute
- **Window**: 60 seconds
- **Block Duration**: 60 seconds after limit exceeded
- **Headers**: Rate limit information is included in response headers

### CORS

- **Origin**: All origins allowed (`*`)
- **Methods**: GET, POST, PATCH, DELETE, OPTIONS
- **Credentials**: Enabled

## Base URL & Endpoints

- **Development**: `http://localhost:5090/api`
- **Production**: `https://api.streamstocks.com/api`
- **Documentation**: `/api/docs` (Swagger UI)

## Portfolio Management API

### 1. Create Portfolio Entry

**Endpoint**: `POST /api/portfolio`

**Description**: Add a new stock to the portfolio with automatic Yahoo Finance integration.

**Request Body**:

```json
{
  "stockName": "Reliance Industries Limited",
  "exchange": "NSE",
  "stockCode": "RELIANCE",
  "quantity": 10.5,
  "purchasePrice": 2500.5,
  "sector": "Energy",
  "notes": "Long-term investment in energy sector"
}
```

**Response** (201 Created):

```json
{
  "statusCode": 201,
  "message": "Stock added to portfolio successfully",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "stockName": "Reliance Industries Limited",
    "exchange": "NSE",
    "stockCode": "RELIANCE",
    "yahooSymbol": "RELIANCE.NS",
    "sector": "Energy",
    "quantity": 10.5,
    "purchasePrice": 2500.5,
    "investmentAmount": 26255.25,
    "currentPrice": null,
    "priceUpdatedAt": null,
    "presentValue": null,
    "gainLossAmount": null,
    "gainLossPercentage": null,
    "peRatio": null,
    "eps": null,
    "fundamentalsUpdatedAt": null,
    "notes": "Long-term investment in energy sector",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

**Validation Rules**:

- `stockName`: Required, string, 1-255 characters
- `exchange`: Required, enum (NSE, BSE)
- `stockCode`: Required, string, 1-20 characters, alphanumeric only
- `quantity`: Required, positive number, 4 decimal places max
- `purchasePrice`: Required, positive number, 2 decimal places max
- `sector`: Optional, enum (defaults to "Other")
- `notes`: Optional, string, 1000 characters max

### 2. Get Portfolio Entries

**Endpoint**: `GET /api/portfolio`

**Description**: Retrieve portfolio entries with advanced filtering, sorting, and pagination.

**Query Parameters**:

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10, max: 100)
- `search` (optional): Search in stock name or code
- `exchange` (optional): Filter by exchange (NSE/BSE)
- `sector` (optional): Filter by sector
- `profitableOnly` (optional): Show only profitable stocks
- `lossOnly` (optional): Show only loss-making stocks
- `sortBy` (optional): Sort field (default: stockName)
- `sortOrder` (optional): Sort direction (ASC/DESC, default: ASC)
- `stalePriceHours` (optional): Show stocks with stale prices

**Example Request**:

```
GET /api/portfolio?page=1&limit=20&exchange=NSE&sector=Financial Services&sortBy=gainLossPercentage&sortOrder=DESC
```

**Response** (200 OK):

```json
{
  "statusCode": 200,
  "message": "Portfolio entries retrieved successfully",
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "stockName": "HDFC Bank Limited",
      "exchange": "NSE",
      "stockCode": "HDFCBANK",
      "yahooSymbol": "HDFCBANK.NS",
      "sector": "Financial Services",
      "quantity": 50,
      "purchasePrice": 1500.0,
      "investmentAmount": 75000.0,
      "currentPrice": 1650.0,
      "priceUpdatedAt": "2024-01-15T10:30:00Z",
      "presentValue": 82500.0,
      "gainLossAmount": 7500.0,
      "gainLossPercentage": 10.0,
      "peRatio": 18.5,
      "eps": 45.25,
      "fundamentalsUpdatedAt": "2024-01-15T10:30:00Z",
      "notes": "Blue chip banking stock",
      "createdAt": "2024-01-01T09:00:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 25,
  "page": 1,
  "limit": 20,
  "totalPages": 2
}
```

### 3. Get Portfolio Entry by ID

**Endpoint**: `GET /api/portfolio/:id`

**Description**: Retrieve a specific portfolio entry by its UUID.

**Path Parameters**:

- `id`: Portfolio entry UUID

**Example Request**:

```
GET /api/portfolio/123e4567-e89b-12d3-a456-426614174000
```

**Response** (200 OK):

```json
{
  "statusCode": 200,
  "message": "Portfolio entry retrieved successfully",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "stockName": "Reliance Industries Limited",
    "exchange": "NSE",
    "stockCode": "RELIANCE",
    "yahooSymbol": "RELIANCE.NS",
    "sector": "Energy",
    "quantity": 10.5,
    "purchasePrice": 2500.5,
    "investmentAmount": 26255.25,
    "currentPrice": 2750.75,
    "priceUpdatedAt": "2024-01-15T10:30:00Z",
    "presentValue": 28882.88,
    "gainLossAmount": 2627.63,
    "gainLossPercentage": 10.0,
    "peRatio": 15.5,
    "eps": 25.75,
    "fundamentalsUpdatedAt": "2024-01-15T10:30:00Z",
    "notes": "Long-term investment in energy sector",
    "createdAt": "2024-01-01T09:00:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### 4. Update Portfolio Entry

**Endpoint**: `PATCH /api/portfolio/:id`

**Description**: Update an existing portfolio entry.

**Path Parameters**:

- `id`: Portfolio entry UUID

**Request Body** (partial update):

```json
{
  "quantity": 15.0,
  "purchasePrice": 2400.0,
  "notes": "Updated investment strategy - increased position"
}
```

**Response** (200 OK):

```json
{
  "statusCode": 200,
  "message": "Portfolio entry updated successfully",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "stockName": "Reliance Industries Limited",
    "exchange": "NSE",
    "stockCode": "RELIANCE",
    "yahooSymbol": "RELIANCE.NS",
    "sector": "Energy",
    "quantity": 15.0,
    "purchasePrice": 2400.0,
    "investmentAmount": 36000.0,
    "currentPrice": 2750.75,
    "priceUpdatedAt": "2024-01-15T10:30:00Z",
    "presentValue": 41261.25,
    "gainLossAmount": 5261.25,
    "gainLossPercentage": 14.61,
    "peRatio": 15.5,
    "eps": 25.75,
    "fundamentalsUpdatedAt": "2024-01-15T10:30:00Z",
    "notes": "Updated investment strategy - increased position",
    "createdAt": "2024-01-01T09:00:00Z",
    "updatedAt": "2024-01-15T11:00:00Z"
  }
}
```

### 5. Delete Portfolio Entry

**Endpoint**: `DELETE /api/portfolio/:id`

**Description**: Remove a stock from the portfolio.

**Path Parameters**:

- `id`: Portfolio entry UUID

**Example Request**:

```
DELETE /api/portfolio/123e4567-e89b-12d3-a456-426614174000
```

**Response** (200 OK):

```json
{
  "statusCode": 200,
  "message": "Portfolio entry deleted successfully"
}
```

## Portfolio Analytics API

### 1. Portfolio Summary

**Endpoint**: `GET /api/portfolio/summary`

**Description**: Get comprehensive portfolio performance overview.

**Response** (200 OK):

```json
{
  "statusCode": 200,
  "message": "Portfolio summary retrieved successfully",
  "data": {
    "totalEntries": 25,
    "totalInvestment": 1500000.0,
    "currentValue": 1650000.0,
    "totalGainLoss": 150000.0,
    "totalGainLossPercentage": 10.0,
    "averageGainLossPercentage": 8.5,
    "profitableEntries": 18,
    "lossEntries": 7,
    "lastUpdated": "2024-01-15T10:30:00Z"
  }
}
```

### 2. Portfolio by Exchange

**Endpoint**: `GET /api/portfolio/by-exchange`

**Description**: Get portfolio breakdown by NSE and BSE exchanges.

**Response** (200 OK):

```json
{
  "statusCode": 200,
  "message": "Portfolio breakdown by exchange retrieved successfully",
  "data": {
    "NSE": {
      "totalInvestment": 1000000.0,
      "currentValue": 1100000.0,
      "gainLoss": 100000.0,
      "gainLossPercentage": 10.0,
      "entryCount": 15
    },
    "BSE": {
      "totalInvestment": 500000.0,
      "currentValue": 550000.0,
      "gainLoss": 50000.0,
      "gainLossPercentage": 10.0,
      "entryCount": 10
    }
  }
}
```

### 3. Portfolio by Sector

**Endpoint**: `GET /api/portfolio/by-sector`

**Description**: Get portfolio breakdown by business sectors.

**Response** (200 OK):

```json
{
  "statusCode": 200,
  "message": "Portfolio sector breakdown retrieved successfully",
  "data": [
    {
      "sector": "Financial Services",
      "totalInvestment": 500000.0,
      "currentValue": 550000.0,
      "gainLoss": 50000.0,
      "gainLossPercentage": 10.0,
      "entryCount": 8,
      "averagePERatio": 15.5,
      "averageEPS": 25.75
    },
    {
      "sector": "Information Technology",
      "totalInvestment": 300000.0,
      "currentValue": 330000.0,
      "gainLoss": 30000.0,
      "gainLossPercentage": 10.0,
      "entryCount": 5,
      "averagePERatio": 22.3,
      "averageEPS": 35.2
    }
  ]
}
```

## Market Data API

### 1. Update All Stock Prices

**Endpoint**: `POST /api/portfolio/update-all-prices`

**Description**: Fetch latest market data for all portfolio stocks.

**Response** (200 OK):

```json
{
  "statusCode": 200,
  "message": "Market data update completed",
  "data": {
    "totalStocks": 25,
    "updatedStocks": 23,
    "failedUpdates": 2,
    "updateDuration": 15000,
    "lastUpdated": "2024-01-15T10:30:00Z"
  }
}
```

### 2. Update Specific Stock Market Data

**Endpoint**: `POST /api/portfolio/:id/update-market-data`

**Description**: Update market data for a specific portfolio entry.

**Path Parameters**:

- `id`: Portfolio entry UUID

**Response** (200 OK):

```json
{
  "statusCode": 200,
  "message": "Market data updated successfully",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "stockName": "Reliance Industries Limited",
    "currentPrice": 2750.75,
    "priceUpdatedAt": "2024-01-15T10:30:00Z",
    "peRatio": 15.5,
    "eps": 25.75,
    "fundamentalsUpdatedAt": "2024-01-15T10:30:00Z"
  }
}
```

## WebSocket API

### Connection

**Namespace**: `/portfolio`

**Connection URL**: `ws://localhost:5090/portfolio`

### Events

#### Client to Server

1. **Subscribe to Portfolio Updates**

   ```javascript
   socket.emit('subscribe_portfolio', {
     clientInfo: {
       userId: 'user123',
       platform: 'web',
     },
   });
   ```

2. **Unsubscribe from Portfolio Updates**
   ```javascript
   socket.emit('unsubscribe_portfolio');
   ```

#### Server to Client

1. **Connection Status**

   ```javascript
   socket.on('connection_status', (data) => {
     console.log('Connected:', data);
     // {
     //   status: 'connected',
     //   clientId: 'abc123',
     //   connectedClients: 15,
     //   timestamp: '2024-01-15T10:30:00Z'
     // }
   });
   ```

2. **Subscription Confirmation**

   ```javascript
   socket.on('subscription_confirmed', (data) => {
     console.log('Subscription:', data);
     // {
     //   type: 'portfolio_subscription',
     //   status: 'subscribed',
     //   timestamp: '2024-01-15T10:30:00Z'
     // }
   });
   ```

3. **Portfolio Updates**

   ```javascript
   socket.on('portfolio_update', (data) => {
     console.log('Portfolio update:', data);
     // {
     //   type: 'portfolio_update',
     //   action: 'entry_added',
     //   portfolioEntryId: '123e4567-e89b-12d3-a456-426614174000',
     //   stockName: 'Reliance Industries Limited',
     //   stockCode: 'RELIANCE',
     //   exchange: 'NSE'
     // }
   });
   ```

4. **Price Updates**
   ```javascript
   socket.on('price_update', (data) => {
     console.log('Price update:', data);
     // {
     //   type: 'price_update',
     //   portfolioEntryId: '123e4567-e89b-12d3-a456-426614174000',
     //   stockName: 'Reliance Industries Limited',
     //   stockCode: 'RELIANCE',
     //   exchange: 'NSE',
     //   currentPrice: 2750.75,
     //   previousPrice: 2700.00,
     //   change: 50.75,
     //   changePercent: 1.88,
     //   timestamp: '2024-01-15T10:30:00Z'
     // }
   });
   ```

### WebSocket Status

**Endpoint**: `GET /api/portfolio/websocket-status`

**Description**: Get real-time WebSocket connection statistics.

**Response** (200 OK):

```json
{
  "statusCode": 200,
  "message": "WebSocket status retrieved successfully",
  "data": {
    "totalConnections": 15,
    "activeConnections": 12,
    "disconnectedClients": 3,
    "lastConnection": "2024-01-15T10:30:00Z",
    "lastDisconnection": "2024-01-15T10:25:00Z",
    "uptime": 86400000
  }
}
```

## Error Handling

### Standard Error Response Format

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "errors": [
    "stockName should not be empty",
    "purchasePrice must be a positive number"
  ]
}
```

### Common HTTP Status Codes

- **200**: Success
- **201**: Created
- **400**: Bad Request (validation errors)
- **404**: Not Found
- **409**: Conflict (duplicate entry)
- **429**: Too Many Requests (rate limit exceeded)
- **500**: Internal Server Error

### Validation Errors

The API uses comprehensive validation with detailed error messages:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    "stockCode must match ^[A-Z0-9]+$ regular expression",
    "quantity must not be less than 0.0001",
    "purchasePrice must not be less than 0.01"
  ]
}
```

## Data Models

### Portfolio Entity

The core data model includes:

- **Stock Information**: Name, code, exchange, sector
- **Investment Details**: Quantity, purchase price, investment amount
- **Market Data**: Current price, price update timestamp
- **Calculated Fields**: Present value, gain/loss amount and percentage
- **Fundamentals**: P/E ratio, EPS, fundamentals update timestamp
- **Metadata**: Notes, creation and update timestamps

### Supported Exchanges

- **NSE**: National Stock Exchange of India
- **BSE**: Bombay Stock Exchange

### Supported Sectors

Financial Services, Information Technology, Consumer Goods, Healthcare, Energy, Automobiles, Telecommunications, Banking, Metals, Chemicals, Textiles, Cement, Power, Real Estate, Media, FMCG, Infrastructure, Oil and Gas, Pharmaceuticals, Agriculture, Other

## Integration Examples

### JavaScript/Node.js Client

```javascript
const axios = require('axios');

class PortfolioClient {
  constructor(baseURL = 'http://localhost:5090/api') {
    this.baseURL = baseURL;
  }

  async createEntry(entryData) {
    try {
      const response = await axios.post(`${this.baseURL}/portfolio`, entryData);
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to create entry: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async getPortfolio(query = {}) {
    try {
      const response = await axios.get(`${this.baseURL}/portfolio`, {
        params: query,
      });
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to get portfolio: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async getSummary() {
    try {
      const response = await axios.get(`${this.baseURL}/portfolio/summary`);
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to get summary: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async updateMarketData(entryId) {
    try {
      const response = await axios.post(
        `${this.baseURL}/portfolio/${entryId}/update-market-data`,
      );
      return response.data;
    } catch (error) {
      throw new Error(
        `Failed to update market data: ${error.response?.data?.message || error.message}`,
      );
    }
  }
}

// Usage
const client = new PortfolioClient();
client
  .createEntry({
    stockName: 'TCS Limited',
    exchange: 'NSE',
    stockCode: 'TCS',
    quantity: 100,
    purchasePrice: 3500.0,
    sector: 'Information Technology',
  })
  .then(console.log)
  .catch(console.error);
```

### WebSocket Client (JavaScript)

```javascript
const io = require('socket.io-client');

class PortfolioWebSocketClient {
  constructor(url = 'http://localhost:5090') {
    this.socket = io(`${url}/portfolio`);
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.socket.on('connect', () => {
      console.log('Connected to portfolio WebSocket');
      this.subscribe();
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from portfolio WebSocket');
    });

    this.socket.on('connection_status', (data) => {
      console.log('Connection status:', data);
    });

    this.socket.on('subscription_confirmed', (data) => {
      console.log('Subscription confirmed:', data);
    });

    this.socket.on('portfolio_update', (data) => {
      console.log('Portfolio update:', data);
      this.handlePortfolioUpdate(data);
    });

    this.socket.on('price_update', (data) => {
      console.log('Price update:', data);
      this.handlePriceUpdate(data);
    });
  }

  subscribe() {
    this.socket.emit('subscribe_portfolio', {
      clientInfo: {
        userId: 'user123',
        platform: 'nodejs',
      },
    });
  }

  unsubscribe() {
    this.socket.emit('unsubscribe_portfolio');
  }

  handlePortfolioUpdate(data) {
    switch (data.action) {
      case 'entry_added':
        console.log(`New stock added: ${data.stockName} (${data.stockCode})`);
        break;
      case 'entry_updated':
        console.log(`Stock updated: ${data.stockName} (${data.stockCode})`);
        break;
      case 'entry_deleted':
        console.log(`Stock removed: ${data.stockName} (${data.stockCode})`);
        break;
    }
  }

  handlePriceUpdate(data) {
    console.log(
      `${data.stockName}: ₹${data.currentPrice} (${data.changePercent > 0 ? '+' : ''}${data.changePercent}%)`,
    );
  }

  disconnect() {
    this.socket.disconnect();
  }
}

// Usage
const wsClient = new PortfolioWebSocketClient();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down WebSocket client...');
  wsClient.disconnect();
  process.exit(0);
});
```
