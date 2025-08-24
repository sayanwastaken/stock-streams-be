import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { PortfolioService } from '../services/portfolio.service';
import { CreatePortfolioEntryDto } from '../dto/create-portfolio-entry.dto';
import { UpdatePortfolioEntryDto } from '../dto/update-portfolio-entry.dto';
import { PortfolioQueryDto } from '../dto/portfolio-query.dto';
import { PortfolioWebSocketService } from '../websockets/portfolio-websocket.service';

@ApiTags('portfolio')
@Controller('portfolio')
@UseGuards(ThrottlerGuard)
@ApiResponse({
  status: 429,
  description: 'Too many requests - rate limit exceeded',
})
export class PortfolioController {
  constructor(
    private readonly portfolioService: PortfolioService,
    private readonly portfolioWebSocketService: PortfolioWebSocketService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Add a new stock to portfolio',
    description:
      'Add a new stock entry to the global portfolio with automatic Yahoo Finance integration. The system will automatically generate Yahoo Finance symbols and fetch initial market data.',
  })
  @ApiResponse({
    status: 201,
    description: 'Stock added to portfolio successfully',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 201 },
        message: {
          type: 'string',
          example: 'Stock added to portfolio successfully',
        },
        data: { $ref: '#/components/schemas/Portfolio' },
      },
    },
  })
  @ApiConflictResponse({
    description:
      'Stock with same code and exchange already exists in portfolio',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 409 },
        message: {
          type: 'string',
          example: 'Portfolio entry with code already exists',
        },
        error: { type: 'string', example: 'Conflict' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data or validation errors',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 400 },
        message: { type: 'string', example: 'Validation failed' },
        errors: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  async create(@Body() createPortfolioEntryDto: CreatePortfolioEntryDto) {
    return {
      statusCode: HttpStatus.CREATED,
      message: 'Stock added to portfolio successfully',
      data: await this.portfolioService.create(createPortfolioEntryDto),
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all portfolio entries',
    description:
      'Retrieve all stocks in the portfolio with advanced filtering, sorting, and pagination. Supports filtering by exchange, sector, profitability, and search queries.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for pagination (default: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of items per page (default: 10, max: 100)',
    example: 10,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Search query for stock name or code',
    example: 'RELIANCE',
  })
  @ApiQuery({
    name: 'exchange',
    required: false,
    enum: ['NSE', 'BSE'],
    description: 'Filter by exchange (NSE or BSE)',
    example: 'NSE',
  })
  @ApiQuery({
    name: 'sector',
    required: false,
    enum: [
      'Financial Services',
      'Information Technology',
      'Consumer Goods',
      'Healthcare',
      'Energy',
      'Automobiles',
      'Telecommunications',
      'Banking',
      'Metals',
      'Chemicals',
      'Textiles',
      'Cement',
      'Power',
      'Real Estate',
      'Media',
      'FMCG',
      'Infrastructure',
      'Oil and Gas',
      'Pharmaceuticals',
      'Agriculture',
      'Other',
    ],
    description: 'Filter by sector',
    example: 'Financial Services',
  })
  @ApiQuery({
    name: 'profitableOnly',
    required: false,
    type: Boolean,
    description: 'Filter to show only profitable stocks',
    example: true,
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: [
      'stockName',
      'stockCode',
      'exchange',
      'sector',
      'quantity',
      'purchasePrice',
      'currentPrice',
      'gainLossAmount',
      'gainLossPercentage',
      'createdAt',
      'updatedAt',
    ],
    description: 'Field to sort by',
    example: 'stockName',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: ['ASC', 'DESC'],
    description: 'Sort order (ascending or descending)',
    example: 'ASC',
  })
  @ApiResponse({
    status: 200,
    description: 'Portfolio entries retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: {
          type: 'string',
          example: 'Portfolio entries retrieved successfully',
        },
        data: {
          type: 'array',
          items: { $ref: '#/components/schemas/Portfolio' },
        },
        total: { type: 'number', example: 25 },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 10 },
        totalPages: { type: 'number', example: 3 },
      },
    },
  })
  async findAll(@Query() query: PortfolioQueryDto) {
    const result = await this.portfolioService.findAll(query);
    return {
      statusCode: HttpStatus.OK,
      message: 'Portfolio entries retrieved successfully',
      ...result,
    };
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get portfolio summary',
    description:
      'Get comprehensive portfolio performance summary including total investment, current market value, overall gain/loss, and performance metrics across all holdings.',
  })
  @ApiResponse({
    status: 200,
    description: 'Portfolio summary retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: {
          type: 'string',
          example: 'Portfolio summary retrieved successfully',
        },
        data: {
          type: 'object',
          properties: {
            totalEntries: { type: 'number', example: 25 },
            totalInvestment: { type: 'number', example: 150000.0 },
            currentValue: { type: 'number', example: 165000.0 },
            totalGainLoss: { type: 'number', example: 15000.0 },
            totalGainLossPercentage: { type: 'number', example: 10.0 },
            averageGainLossPercentage: { type: 'number', example: 8.5 },
            profitableEntries: { type: 'number', example: 18 },
            lossEntries: { type: 'number', example: 7 },
            lastUpdated: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  async getSummary() {
    return {
      statusCode: HttpStatus.OK,
      message: 'Portfolio summary retrieved successfully',
      data: await this.portfolioService.getSummary(),
    };
  }

  @Get('by-exchange')
  @ApiOperation({
    summary: 'Get portfolio breakdown by exchange',
    description:
      'Get detailed portfolio performance breakdown by NSE and BSE exchanges, including investment amounts, current values, and performance metrics for each exchange.',
  })
  @ApiResponse({
    status: 200,
    description: 'Portfolio breakdown by exchange retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: {
          type: 'string',
          example: 'Portfolio breakdown by exchange retrieved successfully',
        },
        data: {
          type: 'object',
          properties: {
            NSE: {
              type: 'object',
              properties: {
                totalInvestment: { type: 'number', example: 100000.0 },
                currentValue: { type: 'number', example: 110000.0 },
                gainLoss: { type: 'number', example: 10000.0 },
                gainLossPercentage: { type: 'number', example: 10.0 },
                entryCount: { type: 'number', example: 15 },
              },
            },
            BSE: {
              type: 'object',
              properties: {
                totalInvestment: { type: 'number', example: 50000.0 },
                currentValue: { type: 'number', example: 55000.0 },
                gainLoss: { type: 'number', example: 5000.0 },
                gainLossPercentage: { type: 'number', example: 10.0 },
                entryCount: { type: 'number', example: 10 },
              },
            },
          },
        },
      },
    },
  })
  async getByExchange() {
    return {
      statusCode: HttpStatus.OK,
      message: 'Portfolio breakdown by exchange retrieved successfully',
      data: await this.portfolioService.getByExchange(),
    };
  }

  @Get('by-sector')
  @ApiOperation({
    summary: 'Get portfolio breakdown by sector',
    description:
      'Get comprehensive portfolio performance breakdown grouped by sector, including investment amounts, performance metrics, and average fundamental ratios for each sector.',
  })
  @ApiResponse({
    status: 200,
    description: 'Portfolio sector breakdown retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: {
          type: 'string',
          example: 'Portfolio sector breakdown retrieved successfully',
        },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sector: { type: 'string', example: 'Financial Services' },
              totalInvestment: { type: 'number', example: 50000.0 },
              currentValue: { type: 'number', example: 55000.0 },
              gainLoss: { type: 'number', example: 5000.0 },
              gainLossPercentage: { type: 'number', example: 10.0 },
              entryCount: { type: 'number', example: 8 },
              averagePERatio: { type: 'number', example: 15.5 },
              averageEPS: { type: 'number', example: 25.75 },
            },
          },
        },
      },
    },
  })
  async getBySector() {
    return {
      statusCode: HttpStatus.OK,
      message: 'Portfolio sector breakdown retrieved successfully',
      data: await this.portfolioService.getBySector(),
    };
  }

  @Post('update-all-prices')
  @ApiOperation({
    summary: 'Update all stock prices',
    description:
      'Fetch latest market data including prices and fundamental ratios for all stocks in the portfolio. This operation may take time depending on the number of stocks and market data availability.',
  })
  @ApiResponse({
    status: 200,
    description: 'Market data update completed successfully',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: { type: 'string', example: 'Market data update completed' },
        data: {
          type: 'object',
          properties: {
            totalStocks: { type: 'number', example: 25 },
            updatedStocks: { type: 'number', example: 23 },
            failedUpdates: { type: 'number', example: 2 },
            updateDuration: { type: 'number', example: 15000 },
            lastUpdated: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  async updateAllMarketData() {
    return {
      statusCode: HttpStatus.OK,
      message: 'Market data update completed',
      data: await this.portfolioService.updateAllMarketData(),
    };
  }

  @Get('websocket-status')
  @ApiOperation({
    summary: 'Get WebSocket connection status',
    description:
      'Get real-time information about WebSocket connections, active clients, and connection statistics for monitoring real-time update delivery.',
  })
  @ApiResponse({
    status: 200,
    description: 'WebSocket status retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        statusCode: { type: 'number', example: 200 },
        message: {
          type: 'string',
          example: 'WebSocket status retrieved successfully',
        },
        data: {
          type: 'object',
          properties: {
            totalConnections: { type: 'number', example: 15 },
            activeConnections: { type: 'number', example: 12 },
            disconnectedClients: { type: 'number', example: 3 },
            lastConnection: { type: 'string', format: 'date-time' },
            lastDisconnection: { type: 'string', format: 'date-time' },
            uptime: { type: 'number', example: 86400000 },
          },
        },
      },
    },
  })
  async getWebSocketStatus() {
    return {
      statusCode: HttpStatus.OK,
      message: 'WebSocket status retrieved successfully',
      data: this.portfolioWebSocketService.getConnectionStats(),
    };
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a specific portfolio entry',
    description: 'Retrieve a single portfolio entry by its unique ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Portfolio entry ID (UUID)',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 200,
    description: 'Portfolio entry retrieved successfully',
  })
  @ApiNotFoundResponse({
    description: 'Portfolio entry not found',
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Portfolio entry retrieved successfully',
      data: await this.portfolioService.findOne(id),
    };
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a portfolio entry',
    description: 'Update an existing stock entry in the portfolio',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Portfolio entry ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Portfolio entry updated successfully',
  })
  @ApiNotFoundResponse({
    description: 'Portfolio entry not found',
  })
  @ApiConflictResponse({
    description:
      'Another entry with same stock code and exchange already exists',
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePortfolioEntryDto: UpdatePortfolioEntryDto,
  ) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Portfolio entry updated successfully',
      data: await this.portfolioService.update(id, updatePortfolioEntryDto),
    };
  }

  @Post(':id/update-market-data')
  @ApiOperation({
    summary: 'Update market data for specific entry',
    description:
      'Fetch latest price and fundamentals for a specific portfolio entry',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Portfolio entry ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Market data updated successfully',
  })
  @ApiNotFoundResponse({
    description: 'Portfolio entry not found',
  })
  async updateMarketData(@Param('id', ParseUUIDPipe) id: string) {
    return {
      statusCode: HttpStatus.OK,
      message: 'Market data updated successfully',
      data: await this.portfolioService.updateMarketData(id),
    };
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Remove a stock from portfolio',
    description: 'Delete a stock entry from the portfolio',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Portfolio entry ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Portfolio entry deleted successfully',
  })
  @ApiNotFoundResponse({
    description: 'Portfolio entry not found',
  })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.portfolioService.remove(id);
    return {
      statusCode: HttpStatus.OK,
      message: 'Portfolio entry deleted successfully',
    };
  }
}
