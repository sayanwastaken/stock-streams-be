import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  FindOptionsWhere,
  ILike,
  MoreThan,
  LessThan,
  Not,
} from 'typeorm';
import { Portfolio, Exchange } from '../entities/portfolio.entity';
import { CreatePortfolioEntryDto } from '../dto/create-portfolio-entry.dto';
import { UpdatePortfolioEntryDto } from '../dto/update-portfolio-entry.dto';
import { PortfolioQueryDto, SortOrder } from '../dto/portfolio-query.dto';
import { YahooFinanceService } from './yahoo-finance.service';
import { PortfolioWebSocketService } from '../websockets/portfolio-websocket.service';

@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);

  constructor(
    @InjectRepository(Portfolio)
    private portfolioRepository: Repository<Portfolio>,
    private yahooFinanceService: YahooFinanceService,
    private portfolioWebSocketService: PortfolioWebSocketService,
  ) {}

  /**
   * Create a new portfolio entry
   */
  async create(
    createPortfolioEntryDto: CreatePortfolioEntryDto,
  ): Promise<Portfolio> {
    // Check if entry with same exchange and stock code already exists
    const existingEntry = await this.portfolioRepository.findOne({
      where: {
        exchange: createPortfolioEntryDto.exchange,
        stockCode: createPortfolioEntryDto.stockCode,
      },
    });

    if (existingEntry) {
      throw new ConflictException(
        `Portfolio entry with code '${createPortfolioEntryDto.stockCode}' on '${createPortfolioEntryDto.exchange}' already exists`,
      );
    }

    // Create new portfolio entry
    const portfolioEntry = this.portfolioRepository.create(
      createPortfolioEntryDto,
    );
    const savedEntry = await this.portfolioRepository.save(portfolioEntry);

    // Try to fetch current price and fundamentals asynchronously
    this.updateMarketData(savedEntry.id).catch((error) => {
      this.logger.warn(
        `Failed to fetch market data for ${savedEntry.yahooSymbol}: ${error.message}`,
      );
    });

    // Broadcast portfolio entry addition to WebSocket clients
    this.portfolioWebSocketService
      .broadcastPortfolioEntryAdded(savedEntry)
      .catch((error) => {
        this.logger.warn(
          `Failed to broadcast portfolio entry addition: ${error.message}`,
        );
      });

    this.logger.log(
      `Created portfolio entry: ${savedEntry.stockName} (${savedEntry.yahooSymbol})`,
    );
    return savedEntry;
  }

  /**
   * Get all portfolio entries with filtering and pagination
   */
  async findAll(query: PortfolioQueryDto): Promise<{
    data: Portfolio[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit = 10,
      search,
      exchange,
      sector,
      sortBy = 'stockName',
      sortOrder = SortOrder.ASC,
      profitableOnly,
      lossOnly,
      stalePriceHours,
    } = query;

    const queryBuilder =
      this.portfolioRepository.createQueryBuilder('portfolio');

    // Apply filters
    if (search) {
      queryBuilder.andWhere(
        '(LOWER(portfolio.stockName) LIKE LOWER(:search) OR LOWER(portfolio.stockCode) LIKE LOWER(:search))',
        { search: `%${search}%` },
      );
    }

    if (exchange) {
      queryBuilder.andWhere('portfolio.exchange = :exchange', { exchange });
    }

    if (sector) {
      queryBuilder.andWhere('portfolio.sector = :sector', { sector });
    }

    if (profitableOnly) {
      queryBuilder.andWhere('portfolio.gainLossAmount > 0');
    }

    if (lossOnly) {
      queryBuilder.andWhere('portfolio.gainLossAmount < 0');
    }

    if (stalePriceHours) {
      const staleTime = new Date();
      staleTime.setHours(staleTime.getHours() - stalePriceHours);
      queryBuilder.andWhere(
        '(portfolio.priceUpdatedAt IS NULL OR portfolio.priceUpdatedAt < :staleTime)',
        { staleTime },
      );
    }

    // Apply sorting
    queryBuilder.orderBy(`portfolio.${sortBy}`, sortOrder);

    // Apply pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single portfolio entry by ID
   */
  async findOne(id: string): Promise<Portfolio> {
    const portfolioEntry = await this.portfolioRepository.findOne({
      where: { id },
    });

    if (!portfolioEntry) {
      throw new NotFoundException(`Portfolio entry with ID "${id}" not found`);
    }

    return portfolioEntry;
  }

  /**
   * Update a portfolio entry
   */
  async update(
    id: string,
    updatePortfolioEntryDto: UpdatePortfolioEntryDto,
  ): Promise<Portfolio> {
    const portfolioEntry = await this.findOne(id);

    // Check for conflicts if exchange or stock code is being updated
    if (updatePortfolioEntryDto.exchange || updatePortfolioEntryDto.stockCode) {
      const newExchange =
        updatePortfolioEntryDto.exchange || portfolioEntry.exchange;
      const newStockCode =
        updatePortfolioEntryDto.stockCode || portfolioEntry.stockCode;

      if (
        newExchange !== portfolioEntry.exchange ||
        newStockCode !== portfolioEntry.stockCode
      ) {
        const existingEntry = await this.portfolioRepository.findOne({
          where: {
            exchange: newExchange,
            stockCode: newStockCode,
            id: Not(id),
          },
        });

        if (existingEntry) {
          throw new ConflictException(
            `Another portfolio entry with code '${newStockCode}' on '${newExchange}' already exists`,
          );
        }
      }
    }

    // Update the entry
    Object.assign(portfolioEntry, updatePortfolioEntryDto);
    const updatedEntry = await this.portfolioRepository.save(portfolioEntry);

    // Update market data if symbol changed
    if (updatePortfolioEntryDto.exchange || updatePortfolioEntryDto.stockCode) {
      this.updateMarketData(updatedEntry.id).catch((error) => {
        this.logger.warn(
          `Failed to fetch market data for ${updatedEntry.yahooSymbol}: ${error.message}`,
        );
      });
    }

    // Broadcast portfolio entry update to WebSocket clients
    this.portfolioWebSocketService
      .broadcastPortfolioEntryUpdated(updatedEntry)
      .catch((error) => {
        this.logger.warn(
          `Failed to broadcast portfolio entry update: ${error.message}`,
        );
      });

    this.logger.log(
      `Updated portfolio entry: ${updatedEntry.stockName} (${updatedEntry.yahooSymbol})`,
    );
    return updatedEntry;
  }

  /**
   * Delete a portfolio entry
   */
  async remove(id: string): Promise<void> {
    const portfolioEntry = await this.findOne(id);

    // Broadcast portfolio entry deletion to WebSocket clients before deletion
    this.portfolioWebSocketService
      .broadcastPortfolioEntryDeleted(portfolioEntry)
      .catch((error) => {
        this.logger.warn(
          `Failed to broadcast portfolio entry deletion: ${error.message}`,
        );
      });

    await this.portfolioRepository.remove(portfolioEntry);
    this.logger.log(
      `Deleted portfolio entry: ${portfolioEntry.stockName} (${portfolioEntry.yahooSymbol})`,
    );
  }

  /**
   * Get portfolio summary
   */
  async getSummary() {
    const portfolioEntries = await this.portfolioRepository.find();

    if (portfolioEntries.length === 0) {
      return {
        totalStocks: 0,
        totalInvestment: 0,
        totalPresentValue: 0,
        totalGainLoss: 0,
        totalGainLossPercentage: 0,
        profitableStocks: 0,
        lossMakingStocks: 0,
      };
    }

    const totalInvestment = portfolioEntries.reduce(
      (sum, entry) => sum + entry.investmentAmount,
      0,
    );
    const totalPresentValue = portfolioEntries.reduce((sum, entry) => {
      const presentValue = entry.calculatePresentValue();
      return sum + (presentValue || 0);
    }, 0);
    const totalGainLoss = totalPresentValue - totalInvestment;
    const totalGainLossPercentage =
      totalInvestment > 0 ? (totalGainLoss / totalInvestment) * 100 : 0;

    const profitableStocks = portfolioEntries.filter((entry) => {
      const gainLoss = entry.calculateGainLossAmount();
      return gainLoss && gainLoss > 0;
    }).length;

    const lossMakingStocks = portfolioEntries.filter((entry) => {
      const gainLoss = entry.calculateGainLossAmount();
      return gainLoss && gainLoss < 0;
    }).length;

    return {
      totalStocks: portfolioEntries.length,
      totalInvestment,
      totalPresentValue,
      totalGainLoss,
      totalGainLossPercentage: Number(totalGainLossPercentage.toFixed(2)),
      profitableStocks,
      lossMakingStocks,
    };
  }

  /**
   * Get portfolio breakdown by exchange
   */
  async getByExchange() {
    const portfolioEntries = await this.portfolioRepository.find();

    const exchangeGroups = portfolioEntries.reduce(
      (groups, entry) => {
        if (!groups[entry.exchange]) {
          groups[entry.exchange] = [];
        }
        groups[entry.exchange].push(entry);
        return groups;
      },
      {} as Record<string, Portfolio[]>,
    );

    const totalPortfolioInvestment = portfolioEntries.reduce((sum, entry) => {
      // Use stored investmentAmount or calculate it if null/invalid
      const investmentAmount =
        entry.investmentAmount || entry.calculateInvestmentAmount();
      return sum + Number(investmentAmount || 0);
    }, 0);

    return Object.entries(exchangeGroups).map(([exchange, entries]) => {
      const totalInvestment = entries.reduce((sum, entry) => {
        // Use stored investmentAmount or calculate it if null/invalid
        const investmentAmount =
          entry.investmentAmount || entry.calculateInvestmentAmount();
        return sum + Number(investmentAmount || 0);
      }, 0);
      const totalPresentValue = entries.reduce((sum, entry) => {
        const presentValue = entry.calculatePresentValue();
        return sum + Number(presentValue || 0);
      }, 0);

      // Handle case where currentPrice might be null (no market data yet)
      const totalGainLoss =
        totalPresentValue > 0 ? totalPresentValue - totalInvestment : 0;
      const gainLossPercentage =
        totalInvestment > 0 && totalPresentValue > 0
          ? (totalGainLoss / totalInvestment) * 100
          : 0;
      const portfolioPercentage =
        totalPortfolioInvestment > 0
          ? (totalInvestment / totalPortfolioInvestment) * 100
          : 0;

      return {
        exchange,
        stockCount: entries.length,
        totalInvestment: Number(totalInvestment.toFixed(2)),
        totalPresentValue: Number(totalPresentValue.toFixed(2)),
        totalGainLoss: Number(totalGainLoss.toFixed(2)),
        gainLossPercentage: Number(gainLossPercentage.toFixed(2)),
        portfolioPercentage: Number(portfolioPercentage.toFixed(2)),
      };
    });
  }

  /**
   * Get portfolio breakdown by sector
   */
  async getBySector() {
    const portfolioEntries = await this.portfolioRepository.find();

    const sectorGroups = portfolioEntries.reduce(
      (groups, entry) => {
        if (!groups[entry.sector]) {
          groups[entry.sector] = [];
        }
        groups[entry.sector].push(entry);
        return groups;
      },
      {} as Record<string, Portfolio[]>,
    );

    const totalPortfolioInvestment = portfolioEntries.reduce((sum, entry) => {
      // Use stored investmentAmount or calculate it if null/invalid
      const investmentAmount =
        entry.investmentAmount || entry.calculateInvestmentAmount();
      return sum + Number(investmentAmount || 0);
    }, 0);

    return Object.entries(sectorGroups).map(([sector, entries]) => {
      const totalInvestment = entries.reduce((sum, entry) => {
        // Use stored investmentAmount or calculate it if null/invalid
        const investmentAmount =
          entry.investmentAmount || entry.calculateInvestmentAmount();
        return sum + Number(investmentAmount || 0);
      }, 0);
      const totalPresentValue = entries.reduce((sum, entry) => {
        const presentValue = entry.calculatePresentValue();
        return sum + Number(presentValue || 0);
      }, 0);

      // Handle case where currentPrice might be null (no market data yet)
      const totalGainLoss =
        totalPresentValue > 0 ? totalPresentValue - totalInvestment : 0;
      const gainLossPercentage =
        totalInvestment > 0 && totalPresentValue > 0
          ? (totalGainLoss / totalInvestment) * 100
          : 0;
      const portfolioPercentage =
        totalPortfolioInvestment > 0
          ? (totalInvestment / totalPortfolioInvestment) * 100
          : 0;

      // Calculate average P/E ratio for the sector
      const entriesWithPE = entries.filter((entry) => entry.peRatio);
      const avgPeRatio =
        entriesWithPE.length > 0
          ? entriesWithPE.reduce(
              (sum, entry) => sum + Number(entry.peRatio || 0),
              0,
            ) / entriesWithPE.length
          : null;

      return {
        sector,
        stockCount: entries.length,
        totalInvestment: Number(totalInvestment.toFixed(2)),
        totalPresentValue: Number(totalPresentValue.toFixed(2)),
        totalGainLoss: Number(totalGainLoss.toFixed(2)),
        gainLossPercentage: Number(gainLossPercentage.toFixed(2)),
        portfolioPercentage: Number(portfolioPercentage.toFixed(2)),
        avgPeRatio: avgPeRatio ? Number(avgPeRatio.toFixed(2)) : null,
      };
    });
  }

  /**
   * Update market data (prices and fundamentals) for a specific entry
   */
  async updateMarketData(id: string): Promise<Portfolio> {
    const portfolioEntry = await this.findOne(id);
    const previousPrice = portfolioEntry.currentPrice;

    try {
      // Fetch current price
      const quote = await this.yahooFinanceService.getQuote(
        portfolioEntry.yahooSymbol,
      );
      portfolioEntry.currentPrice = quote.price;
      portfolioEntry.priceUpdatedAt = new Date();

      this.logger.debug(
        `Updated price for ${portfolioEntry.yahooSymbol}: ${quote.price}`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to fetch price for ${portfolioEntry.yahooSymbol}: ${error.message}`,
      );
    }

    try {
      // Fetch fundamentals
      const fundamentals = await this.yahooFinanceService.getFundamentals(
        portfolioEntry.yahooSymbol,
      );
      if (fundamentals.peRatio) {
        portfolioEntry.peRatio = fundamentals.peRatio;
      }
      if (fundamentals.eps) {
        portfolioEntry.eps = fundamentals.eps;
      }
      portfolioEntry.fundamentalsUpdatedAt = new Date();

      this.logger.debug(
        `Updated fundamentals for ${portfolioEntry.yahooSymbol}: PE=${fundamentals.peRatio}, EPS=${fundamentals.eps}`,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to fetch fundamentals for ${portfolioEntry.yahooSymbol}: ${error.message}`,
      );
    }

    const updatedEntry = await this.portfolioRepository.save(portfolioEntry);

    // Broadcast price update to WebSocket clients if price changed
    if (
      previousPrice !== updatedEntry.currentPrice &&
      updatedEntry.currentPrice
    ) {
      this.portfolioWebSocketService
        .broadcastPriceUpdate(updatedEntry, previousPrice)
        .catch((error) => {
          this.logger.warn(
            `Failed to broadcast price update: ${error.message}`,
          );
        });
    }

    return updatedEntry;
  }

  /**
   * Update market data for all portfolio entries
   */
  async updateAllMarketData(): Promise<{
    successful: number;
    failed: number;
    errors: string[];
  }> {
    const portfolioEntries = await this.portfolioRepository.find();
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    this.logger.log(
      `Starting market data update for ${portfolioEntries.length} portfolio entries`,
    );

    // Process in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < portfolioEntries.length; i += batchSize) {
      const batch = portfolioEntries.slice(i, i + batchSize);
      const promises = batch.map(async (entry) => {
        try {
          await this.updateMarketData(entry.id);
          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push(
            `${entry.stockName} (${entry.yahooSymbol}): ${error.message}`,
          );
        }
      });

      await Promise.allSettled(promises);

      // Small delay between batches
      if (i + batchSize < portfolioEntries.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    this.logger.log(
      `Market data update completed: ${results.successful} successful, ${results.failed} failed`,
    );
    return results;
  }
}
