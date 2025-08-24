import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';

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
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Stock Information
  @Column({ name: 'stock_name', type: 'text' })
  stockName: string;

  @Column({
    name: 'exchange',
    type: 'enum',
    enum: Exchange,
  })
  exchange: Exchange;

  @Column({ name: 'stock_code', type: 'text' })
  stockCode: string;

  @Column({ name: 'yahoo_symbol', type: 'text', nullable: true })
  yahooSymbol: string;

  @Column({
    name: 'sector',
    type: 'enum',
    enum: Sector,
    default: Sector.OTHER,
  })
  sector: Sector;

  // Investment Details
  @Column({
    name: 'quantity',
    type: 'decimal',
    precision: 14,
    scale: 4,
  })
  quantity: number;

  @Column({
    name: 'purchase_price',
    type: 'decimal',
    precision: 14,
    scale: 2,
  })
  purchasePrice: number;

  // Calculated field - investment amount (quantity * purchase_price)
  @Column({
    name: 'investment_amount',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  investmentAmount: number;

  // Current Market Data
  @Column({
    name: 'current_price',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
  })
  currentPrice: number;

  @Column({
    name: 'price_updated_at',
    type: 'timestamptz',
    nullable: true,
  })
  priceUpdatedAt: Date;

  // Generated columns - calculated fields
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
  @Column({
    name: 'pe_ratio',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  peRatio: number;

  @Column({
    name: 'eps',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  eps: number;

  @Column({
    name: 'fundamentals_updated_at',
    type: 'timestamptz',
    nullable: true,
  })
  fundamentalsUpdatedAt: Date;

  // Metadata
  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

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
