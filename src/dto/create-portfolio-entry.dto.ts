import {
  IsEnum,
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Exchange, Sector } from '../entities/portfolio.entity';

export class CreatePortfolioEntryDto {
  @ApiProperty({
    description: 'Name of the stock/company as registered on the exchange',
    example: 'Reliance Industries Limited',
    minLength: 1,
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  stockName: string;

  @ApiProperty({
    description:
      'Stock exchange where the stock is listed (NSE for National Stock Exchange, BSE for Bombay Stock Exchange)',
    enum: Exchange,
    example: Exchange.NSE,
    enumName: 'Exchange',
  })
  @IsEnum(Exchange)
  exchange: Exchange;

  @ApiProperty({
    description:
      'Official stock code/symbol as listed on the exchange (e.g., RELIANCE, TCS, INFY)',
    example: 'RELIANCE',
    minLength: 1,
    maxLength: 20,
    pattern: '^[A-Z0-9]+$',
  })
  @IsString()
  @IsNotEmpty()
  stockCode: string;

  @ApiProperty({
    description:
      'Number of shares purchased (supports fractional shares with up to 4 decimal places)',
    example: 10.5,
    minimum: 0.0001,
    maximum: 999999.9999,
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  @Min(0.0001)
  quantity: number;

  @ApiProperty({
    description:
      'Purchase price per share in the local currency (INR for Indian markets)',
    example: 2500.5,
    minimum: 0.01,
    maximum: 999999.99,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Min(0.01)
  purchasePrice: number;

  @ApiProperty({
    description:
      'Business sector/industry classification for portfolio analysis and reporting',
    enum: Sector,
    example: Sector.ENERGY,
    default: Sector.OTHER,
    enumName: 'Sector',
  })
  @IsEnum(Sector)
  @IsOptional()
  sector?: Sector;

  @ApiProperty({
    description:
      'Additional notes or comments about the investment decision, strategy, or any other relevant information',
    example:
      'Long-term investment in energy sector. Strong fundamentals and growth potential.',
    required: false,
    maxLength: 1000,
  })
  @IsString()
  @IsOptional()
  notes?: string;
}
