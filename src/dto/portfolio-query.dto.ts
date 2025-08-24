import {
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { Exchange, Sector } from '../entities/portfolio.entity';

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export enum PortfolioSortBy {
  STOCK_NAME = 'stockName',
  EXCHANGE = 'exchange',
  STOCK_CODE = 'stockCode',
  SECTOR = 'sector',
  QUANTITY = 'quantity',
  PURCHASE_PRICE = 'purchasePrice',
  INVESTMENT_AMOUNT = 'investmentAmount',
  CURRENT_PRICE = 'currentPrice',
  PRESENT_VALUE = 'presentValue',
  GAIN_LOSS_AMOUNT = 'gainLossAmount',
  GAIN_LOSS_PERCENTAGE = 'gainLossPercentage',
  PE_RATIO = 'peRatio',
  EPS = 'eps',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
}

export class PortfolioQueryDto {
  @ApiProperty({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    example: 10,
    minimum: 1,
    maximum: 100,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiProperty({
    description: 'Search term for stock name or code',
    example: 'reliance',
    required: false,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Filter by exchange',
    enum: Exchange,
    required: false,
  })
  @IsOptional()
  @IsEnum(Exchange)
  exchange?: Exchange;

  @ApiProperty({
    description: 'Filter by sector',
    enum: Sector,
    required: false,
  })
  @IsOptional()
  @IsEnum(Sector)
  sector?: Sector;

  @ApiProperty({
    description: 'Field to sort by',
    enum: PortfolioSortBy,
    example: PortfolioSortBy.STOCK_NAME,
    required: false,
  })
  @IsOptional()
  @IsEnum(PortfolioSortBy)
  sortBy?: PortfolioSortBy = PortfolioSortBy.STOCK_NAME;

  @ApiProperty({
    description: 'Sort order',
    enum: SortOrder,
    example: SortOrder.ASC,
    required: false,
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.ASC;

  @ApiProperty({
    description: 'Show only profitable stocks',
    example: false,
    required: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  profitableOnly?: boolean;

  @ApiProperty({
    description: 'Show only loss-making stocks',
    example: false,
    required: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  lossOnly?: boolean;

  @ApiProperty({
    description:
      'Show only stocks with stale prices (older than specified hours)',
    example: 24,
    minimum: 1,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  stalePriceHours?: number;
}
