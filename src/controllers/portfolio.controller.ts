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
export class PortfolioController {
  constructor(
    private readonly portfolioService: PortfolioService,
    private readonly portfolioWebSocketService: PortfolioWebSocketService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Add a new stock to portfolio',
    description:
      'Add a new stock entry to the global portfolio with automatic Yahoo Finance integration',
  })
  @ApiResponse({
    status: 201,
    description: 'Stock added to portfolio successfully',
  })
  @ApiConflictResponse({
    description:
      'Stock with same code and exchange already exists in portfolio',
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
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
      'Retrieve all stocks in the portfolio with filtering, sorting, and pagination',
  })
  @ApiResponse({
    status: 200,
    description: 'Portfolio entries retrieved successfully',
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
      'Get overall portfolio performance summary including total investment, current value, and gain/loss',
  })
  @ApiResponse({
    status: 200,
    description: 'Portfolio summary retrieved successfully',
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
      'Get portfolio performance broken down by NSE and BSE exchanges',
  })
  @ApiResponse({
    status: 200,
    description: 'Portfolio breakdown by exchange retrieved successfully',
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
      'Get portfolio performance broken down by industry sectors with sector-level analytics',
  })
  @ApiResponse({
    status: 200,
    description: 'Portfolio breakdown by sector retrieved successfully',
  })
  async getBySector() {
    return {
      statusCode: HttpStatus.OK,
      message: 'Portfolio breakdown by sector retrieved successfully',
      data: await this.portfolioService.getBySector(),
    };
  }

  @Post('update-all-prices')
  @ApiOperation({
    summary: 'Update all stock prices',
    description:
      'Fetch latest prices and fundamentals for all stocks in the portfolio',
  })
  @ApiResponse({
    status: 200,
    description: 'Market data update initiated successfully',
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
      'Get information about WebSocket connections for real-time updates',
  })
  @ApiResponse({
    status: 200,
    description: 'WebSocket status retrieved successfully',
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
    description: 'Retrieve a single stock entry from the portfolio by ID',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    format: 'uuid',
    description: 'Portfolio entry ID',
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
