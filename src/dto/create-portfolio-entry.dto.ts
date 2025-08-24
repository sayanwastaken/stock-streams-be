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
    description: 'Name of the stock/company',
    example: 'Reliance Industries Limited',
  })
  @IsString()
  @IsNotEmpty()
  stockName: string;

  @ApiProperty({
    description: 'Stock exchange where the stock is listed',
    enum: Exchange,
    example: Exchange.NSE,
  })
  @IsEnum(Exchange)
  exchange: Exchange;

  @ApiProperty({
    description: 'Stock code/symbol on the exchange',
    example: 'RELIANCE',
  })
  @IsString()
  @IsNotEmpty()
  stockCode: string;

  @ApiProperty({
    description: 'Quantity of shares purchased',
    example: 10,
    minimum: 0.0001,
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsPositive()
  @Min(0.0001)
  quantity: number;

  @ApiProperty({
    description: 'Purchase price per share',
    example: 2500.5,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Min(0.01)
  purchasePrice: number;

  @ApiProperty({
    description: 'Sector/industry classification of the stock',
    enum: Sector,
    example: Sector.ENERGY,
    default: Sector.OTHER,
  })
  @IsEnum(Sector)
  @IsOptional()
  sector?: Sector;

  @ApiProperty({
    description: 'Optional notes about the investment',
    example: 'Long-term investment in energy sector',
    required: false,
  })
  @IsString()
  @IsOptional()
  notes?: string;
}
