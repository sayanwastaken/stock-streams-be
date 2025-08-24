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
    description: 'Page number for pagination (starts from 1)',
    example: 1,
    minimum: 1,
    required: false,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page (maximum 100 for performance)',
    example: 10,
    minimum: 1,
    maximum: 100,
    required: false,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiProperty({
    description:
      'Search term for stock name or code (case-insensitive partial matching)',
    example: 'reliance',
    required: false,
    minLength: 1,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Filter by stock exchange (NSE or BSE)',
    enum: Exchange,
    required: false,
    enumName: 'Exchange',
  })
  @IsOptional()
  @IsEnum(Exchange)
  exchange?: Exchange;

  @ApiProperty({
    description: 'Filter by business sector/industry classification',
    enum: Sector,
    required: false,
    enumName: 'Sector',
  })
  @IsOptional()
  @IsEnum(Sector)
  sector?: Sector;

  @ApiProperty({
    description: 'Field to sort the portfolio entries by',
    enum: PortfolioSortBy,
    example: PortfolioSortBy.STOCK_NAME,
    required: false,
    default: PortfolioSortBy.STOCK_NAME,
    enumName: 'PortfolioSortBy',
  })
  @IsOptional()
  @IsEnum(PortfolioSortBy)
  sortBy?: PortfolioSortBy = PortfolioSortBy.STOCK_NAME;

  @ApiProperty({
    description: 'Sort order (ascending or descending)',
    enum: SortOrder,
    example: SortOrder.ASC,
    required: false,
    default: SortOrder.ASC,
    enumName: 'SortOrder',
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.ASC;

  @ApiProperty({
    description:
      'Filter to show only stocks with positive gains (current value > investment amount)',
    example: false,
    required: false,
    type: 'boolean',
  })
  @IsOptional()
  @Type(() => Boolean)
  profitableOnly?: boolean;

  @ApiProperty({
    description:
      'Filter to show only stocks with negative gains (current value < investment amount)',
    example: false,
    required: false,
    type: 'boolean',
  })
  @IsOptional()
  @Type(() => Boolean)
  lossOnly?: boolean;

  @ApiProperty({
    description:
      'Filter to show only stocks with stale price data (price update timestamp older than specified hours)',
    example: 24,
    minimum: 1,
    maximum: 168,
    required: false,
    type: 'number',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  stalePriceHours?: number;
}
