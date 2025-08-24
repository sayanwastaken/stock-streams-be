import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum Exchange {
  NSE = 'NSE',
  BSE = 'BSE',
}

export enum Sector {
  FINANCIAL_SERVICES = 'Financial Services',
  INFORMATION_TECHNOLOGY = 'Information Technology',
  CONSUMER_GOODS = 'Consumer Goods',
  HEALTHCARE = 'Healthcare',
  ENERGY = 'Energy',
  AUTOMOBILES = 'Automobiles',
  TELECOMMUNICATIONS = 'Telecommunications',
  BANKING = 'Banking',
  METALS = 'Metals',
  CHEMICALS = 'Chemicals',
  TEXTILES = 'Textiles',
  CEMENT = 'Cement',
  POWER = 'Power',
  REAL_ESTATE = 'Real Estate',
  MEDIA = 'Media',
  FMCG = 'FMCG',
  INFRASTRUCTURE = 'Infrastructure',
  OIL_AND_GAS = 'Oil and Gas',
  PHARMACEUTICALS = 'Pharmaceuticals',
  AGRICULTURE = 'Agriculture',
  OTHER = 'Other',
}

@Entity('portfolio')
export class Portfolio {
  @ApiProperty({
    description: 'Unique identifier for the portfolio entry',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: 'string',
    format: 'uuid',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Stock Information
  @ApiProperty({
    description: 'Name of the stock/company as registered on the exchange',
    example: 'Reliance Industries Limited',
    type: 'string',
  })
  @Column({ name: 'stock_name', type: 'text' })
  stockName: string;

  @ApiProperty({
    description: 'Stock exchange where the stock is listed',
    enum: Exchange,
    example: Exchange.NSE,
    enumName: 'Exchange',
  })
  @Column({
    name: 'exchange',
    type: 'enum',
    enum: Exchange,
  })
  exchange: Exchange;

  @ApiProperty({
    description: 'Official stock code/symbol as listed on the exchange',
    example: 'RELIANCE',
    type: 'string',
  })
  @Column({ name: 'stock_code', type: 'text' })
  stockCode: string;

  @ApiProperty({
    description:
      'Yahoo Finance symbol for fetching market data (auto-generated)',
    example: 'RELIANCE.NS',
    type: 'string',
    nullable: true,
  })
  @Column({ name: 'yahoo_symbol', type: 'text', nullable: true })
  yahooSymbol: string;

  @ApiProperty({
    description: 'Business sector/industry classification of the stock',
    enum: Sector,
    example: Sector.ENERGY,
    default: Sector.OTHER,
    enumName: 'Sector',
  })
  @Column({
    name: 'sector',
    type: 'enum',
    enum: Sector,
    default: Sector.OTHER,
  })
  sector: Sector;

  // Investment Details
  @ApiProperty({
    description: 'Number of shares purchased (supports fractional shares)',
    example: 10.5,
    type: 'number',
    minimum: 0.0001,
  })
  @Column({
    name: 'quantity',
    type: 'decimal',
    precision: 14,
    scale: 4,
  })
  quantity: number;

  @ApiProperty({
    description: 'Purchase price per share in local currency',
    example: 2500.5,
    type: 'number',
    minimum: 0.01,
  })
  @Column({
    name: 'purchase_price',
    type: 'decimal',
    precision: 14,
    scale: 2,
  })
  purchasePrice: number;

  // Calculated field - investment amount (quantity * purchase_price)
  @ApiProperty({
    description:
      'Total investment amount (quantity × purchase price) - auto-calculated',
    example: 26255.25,
    type: 'number',
    nullable: true,
  })
  @Column({
    name: 'investment_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  investmentAmount: number;

  // Current Market Data
  @ApiProperty({
    description: 'Current market price per share (updated from Yahoo Finance)',
    example: 2750.75,
    type: 'number',
    nullable: true,
  })
  @Column({
    name: 'current_price',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  currentPrice: number;

  @ApiProperty({
    description: 'Timestamp when the current price was last updated',
    example: '2024-01-15T10:30:00Z',
    type: 'string',
    format: 'date-time',
    nullable: true,
  })
  @Column({
    name: 'price_updated_at',
    type: 'timestamptz',
    nullable: true,
  })
  priceUpdatedAt: Date;

  // Generated columns - calculated fields
  @ApiProperty({
    description:
      'Current market value of the investment (quantity × current price) - auto-calculated',
    example: 28882.88,
    type: 'number',
    nullable: true,
    readOnly: true,
  })
  @Column({
    name: 'present_value',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
    readonly: true,
    insert: false,
    update: false,
  })
  presentValue: number;

  @ApiProperty({
    description:
      'Absolute gain/loss amount (present value - investment amount) - auto-calculated',
    example: 2627.63,
    type: 'number',
    nullable: true,
    readOnly: true,
  })
  @Column({
    name: 'gain_loss_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
    readonly: true,
    insert: false,
    update: false,
  })
  gainLossAmount: number;

  @ApiProperty({
    description:
      'Percentage gain/loss relative to investment amount - auto-calculated',
    example: 10.0,
    type: 'number',
    nullable: true,
    readOnly: true,
  })
  @Column({
    name: 'gain_loss_percentage',
    type: 'decimal',
    precision: 8,
    scale: 2,
    nullable: true,
    readonly: true,
    insert: false,
    update: false,
  })
  gainLossPercentage: number;

  // Fundamental Data
  @ApiProperty({
    description: 'Price-to-Earnings ratio from Yahoo Finance',
    example: 15.5,
    type: 'number',
    nullable: true,
  })
  @Column({
    name: 'pe_ratio',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  peRatio: number;

  @ApiProperty({
    description: 'Earnings Per Share from Yahoo Finance',
    example: 25.75,
    type: 'number',
    nullable: true,
  })
  @Column({
    name: 'eps',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  eps: number;

  @ApiProperty({
    description: 'Timestamp when fundamental data was last updated',
    example: '2024-01-15T10:30:00Z',
    type: 'string',
    format: 'date-time',
    nullable: true,
  })
  @Column({
    name: 'fundamentals_updated_at',
    type: 'timestamptz',
    nullable: true,
  })
  fundamentalsUpdatedAt: Date;

  // Metadata
  @ApiProperty({
    description: 'Additional notes or comments about the investment',
    example:
      'Long-term investment in energy sector. Strong fundamentals and growth potential.',
    type: 'string',
    nullable: true,
  })
  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string;

  @ApiProperty({
    description: 'Timestamp when the portfolio entry was created',
    example: '2024-01-01T09:00:00Z',
    type: 'string',
    format: 'date-time',
  })
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ApiProperty({
    description: 'Timestamp when the portfolio entry was last updated',
    example: '2024-01-15T10:30:00Z',
    type: 'string',
    format: 'date-time',
  })
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Auto-generate yahoo_symbol and calculate investment amount before insert/update
  @BeforeInsert()
  @BeforeUpdate()
  generateYahooSymbol() {
    if (this.exchange && this.stockCode) {
      switch (this.exchange) {
        case Exchange.NSE:
          this.yahooSymbol = `${this.stockCode}.NS`;
          break;
        case Exchange.BSE:
          this.yahooSymbol = `${this.stockCode}.BO`;
          break;
        default:
          this.yahooSymbol = this.stockCode;
      }
    }

    // Calculate investment amount
    if (this.quantity && this.purchasePrice) {
      this.investmentAmount = this.quantity * this.purchasePrice;
    }
  }

  // Helper methods for calculations (in case generated columns don't work as expected)
  calculateInvestmentAmount(): number {
    return this.quantity * this.purchasePrice;
  }

  calculatePresentValue(): number | null {
    if (!this.currentPrice) return null;
    return this.quantity * this.currentPrice;
  }

  calculateGainLossAmount(): number | null {
    if (!this.currentPrice) return null;
    const presentValue = this.calculatePresentValue();
    if (presentValue === null) return null;
    return presentValue - this.calculateInvestmentAmount();
  }

  calculateGainLossPercentage(): number | null {
    if (!this.currentPrice || this.purchasePrice === 0) return null;
    const gainLoss = this.calculateGainLossAmount();
    if (gainLoss === null) return null;
    const investment = this.calculateInvestmentAmount();
    return (gainLoss / investment) * 100;
  }

  // Check if price data is stale (older than specified hours)
  isPriceStale(hours: number = 24): boolean {
    if (!this.priceUpdatedAt) return true;
    const staleTime = new Date();
    staleTime.setHours(staleTime.getHours() - hours);
    return this.priceUpdatedAt < staleTime;
  }

  // Check if fundamental data is stale
  isFundamentalsStale(hours: number = 24 * 7): boolean {
    // Fundamentals are typically updated weekly
    if (!this.fundamentalsUpdatedAt) return true;
    const staleTime = new Date();
    staleTime.setHours(staleTime.getHours() - hours);
    return this.fundamentalsUpdatedAt < staleTime;
  }
}
