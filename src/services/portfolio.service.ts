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
import { RedisService } from './redis.service';

@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);

  // Cache TTL constants (in seconds)
  private readonly PORTFOLIO_LIST_CACHE_TTL = 300; // 5 minutes for portfolio lists
  private readonly PORTFOLIO_ENTRY_CACHE_TTL = 600; // 10 minutes for individual entries
  private readonly PORTFOLIO_SUMMARY_CACHE_TTL = 300; // 5 minutes for summaries
  private readonly PORTFOLIO_BREAKDOWN_CACHE_TTL = 600; // 10 minutes for breakdowns

  constructor(
    @InjectRepository(Portfolio)
    private portfolioRepository: Repository<Portfolio>,
    private yahooFinanceService: YahooFinanceService,
    private portfolioWebSocketService: PortfolioWebSocketService,
    private redisService: RedisService,
  ) {}

  /**
   * Generate cache key for portfolio list with filters
   */
  private generatePortfolioListCacheKey(query: PortfolioQueryDto): string {
    const queryString = JSON.stringify(query);
    return `portfolio:list:${Buffer.from(queryString).toString('base64')}`;
  }

  /**
   * Generate cache key for individual portfolio entry
   */
  private generatePortfolioEntryCacheKey(id: string): string {
    return `portfolio:entry:${id}`;
  }

  /**
   * Generate cache key for portfolio summary
   */
  private generatePortfolioSummaryCacheKey(): string {
    return 'portfolio:summary';
  }

  /**
   * Generate cache key for portfolio breakdown by exchange
   */
  private generatePortfolioByExchangeCacheKey(): string {
    return 'portfolio:breakdown:exchange';
  }

  /**
   * Generate cache key for portfolio breakdown by sector
   */
  private generatePortfolioBySectorCacheKey(): string {
    return 'portfolio:breakdown:sector';
  }

  /**
   * Clear all portfolio-related cache
   */
  private async clearPortfolioCache(): Promise<void> {
    if (!this.redisService.isAvailable()) return;

    try {
      // Clear all portfolio cache keys
      const keys = [
        'portfolio:list:*',
        'portfolio:entry:*',
        'portfolio:summary',
        'portfolio:breakdown:*',
      ];

      // Note: In production, you might want to use Redis SCAN command
      // For now, we'll clear the specific keys we know about
      await Promise.all([
        this.redisService.del('portfolio:summary'),
        this.redisService.del('portfolio:breakdown:exchange'),
        this.redisService.del('portfolio:breakdown:sector'),
      ]);

      this.logger.debug('Cleared portfolio cache');
    } catch (error) {
      this.logger.error('Failed to clear portfolio cache:', error);
    }
  }

  /**
   * Clear cache for a specific portfolio entry
   */
  private async clearPortfolioEntryCache(id: string): Promise<void> {
    if (!this.redisService.isAvailable()) return;

    try {
      await this.redisService.del(this.generatePortfolioEntryCacheKey(id));
      this.logger.debug(`Cleared cache for portfolio entry: ${id}`);
    } catch (error) {
      this.logger.error(
        `Failed to clear cache for portfolio entry ${id}:`,
        error,
      );
    }
  }

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

    // Clear portfolio cache since we added a new entry
    // Also clear Yahoo Finance cache for this symbol to ensure fresh data
    await Promise.all([
      this.clearPortfolioCache(),
      this.yahooFinanceService.clearSymbolCache(savedEntry.yahooSymbol),
    ]);

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
    const cacheKey = this.generatePortfolioListCacheKey(query);

    // Try to get from cache first
    if (this.redisService.isAvailable()) {
      const cachedData = await this.redisService.get<{
        data: Portfolio[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>(cacheKey);
      if (cachedData) {
        this.logger.debug('Cache hit for portfolio list');
        return cachedData;
      }
    }

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

    const result = {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    // Cache the result
    if (this.redisService.isAvailable()) {
      await this.redisService.set(
        cacheKey,
        result,
        this.PORTFOLIO_LIST_CACHE_TTL,
      );
      this.logger.debug('Cached portfolio list');
    }

    return result;
  }

  /**
   * Get a single portfolio entry by ID
   */
  async findOne(id: string): Promise<Portfolio> {
    const cacheKey = this.generatePortfolioEntryCacheKey(id);

    // Try to get from cache first
    if (this.redisService.isAvailable()) {
      const cachedData = await this.redisService.get<Portfolio>(cacheKey);
      if (cachedData) {
        this.logger.debug(`Cache hit for portfolio entry: ${id}`);
        return cachedData;
      }
    }

    const portfolioEntry = await this.portfolioRepository.findOne({
      where: { id },
    });

    if (!portfolioEntry) {
      throw new NotFoundException(`Portfolio entry with ID "${id}" not found`);
    }

    // Cache the result
    if (this.redisService.isAvailable()) {
      await this.redisService.set(
        cacheKey,
        portfolioEntry,
        this.PORTFOLIO_ENTRY_CACHE_TTL,
      );
      this.logger.debug(`Cached portfolio entry: ${id}`);
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
    const oldYahooSymbol = portfolioEntry.yahooSymbol;

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

    // Clear related cache
    // Also clear Yahoo Finance cache for both old and new symbols if they changed
    const cacheClearingPromises = [
      this.clearPortfolioEntryCache(id),
      this.clearPortfolioCache(),
    ];

    // If the Yahoo symbol changed, clear cache for both old and new symbols
    if (oldYahooSymbol !== updatedEntry.yahooSymbol) {
      cacheClearingPromises.push(
        this.yahooFinanceService.clearSymbolCache(oldYahooSymbol),
        this.yahooFinanceService.clearSymbolCache(updatedEntry.yahooSymbol),
      );
    } else {
      // If symbol didn't change, just clear cache for the current symbol
      cacheClearingPromises.push(
        this.yahooFinanceService.clearSymbolCache(updatedEntry.yahooSymbol),
      );
    }

    await Promise.all(cacheClearingPromises);

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

    // Clear related cache
    // Also clear Yahoo Finance cache for this symbol
    await Promise.all([
      this.clearPortfolioEntryCache(id),
      this.clearPortfolioCache(),
      this.yahooFinanceService.clearSymbolCache(portfolioEntry.yahooSymbol),
    ]);

    this.logger.log(
      `Deleted portfolio entry: ${portfolioEntry.stockName} (${portfolioEntry.yahooSymbol})`,
    );
  }

  /**
   * Get portfolio summary
   */
  async getSummary() {
    const cacheKey = this.generatePortfolioSummaryCacheKey();

    // Try to get from cache first
    if (this.redisService.isAvailable()) {
      const cachedData = await this.redisService.get<any>(cacheKey);
      if (cachedData) {
        this.logger.debug('Cache hit for portfolio summary');
        return cachedData;
      }
    }

    const portfolioEntries = await this.portfolioRepository.find();

    if (portfolioEntries.length === 0) {
      const emptySummary = {
        totalStocks: 0,
        totalInvestment: 0,
        totalPresentValue: 0,
        totalGainLoss: 0,
        totalGainLossPercentage: 0,
        profitableStocks: 0,
        lossMakingStocks: 0,
      };

      // Cache empty summary
      if (this.redisService.isAvailable()) {
        await this.redisService.set(
          cacheKey,
          emptySummary,
          this.PORTFOLIO_SUMMARY_CACHE_TTL,
        );
      }

      return emptySummary;
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

    const summary = {
      totalStocks: portfolioEntries.length,
      totalInvestment,
      totalPresentValue,
      totalGainLoss,
      totalGainLossPercentage: Number(totalGainLossPercentage.toFixed(2)),
      profitableStocks,
      lossMakingStocks,
    };

    // Cache the result
    if (this.redisService.isAvailable()) {
      await this.redisService.set(
        cacheKey,
        summary,
        this.PORTFOLIO_SUMMARY_CACHE_TTL,
      );
      this.logger.debug('Cached portfolio summary');
    }

    return summary;
  }

  /**
   * Get portfolio breakdown by exchange
   */
  async getByExchange() {
    const cacheKey = this.generatePortfolioByExchangeCacheKey();

    // Try to get from cache first
    if (this.redisService.isAvailable()) {
      const cachedData = await this.redisService.get<any[]>(cacheKey);
      if (cachedData) {
        this.logger.debug('Cache hit for portfolio breakdown by exchange');
        return cachedData;
      }
    }

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

    const breakdown = Object.entries(exchangeGroups).map(
      ([exchange, entries]) => {
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
      },
    );

    // Cache the result
    if (this.redisService.isAvailable()) {
      await this.redisService.set(
        cacheKey,
        breakdown,
        this.PORTFOLIO_BREAKDOWN_CACHE_TTL,
      );
      this.logger.debug('Cached portfolio breakdown by exchange');
    }

    return breakdown;
  }

  /**
   * Get portfolio breakdown by sector
   */
  async getBySector() {
    const cacheKey = this.generatePortfolioBySectorCacheKey();

    // Try to get from cache first
    if (this.redisService.isAvailable()) {
      const cachedData = await this.redisService.get<any[]>(cacheKey);
      if (cachedData) {
        this.logger.debug('Cache hit for portfolio breakdown by sector');
        return cachedData;
      }
    }

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

    const breakdown = Object.entries(sectorGroups).map(([sector, entries]) => {
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

    // Cache the result
    if (this.redisService.isAvailable()) {
      await this.redisService.set(
        cacheKey,
        breakdown,
        this.PORTFOLIO_BREAKDOWN_CACHE_TTL,
      );
      this.logger.debug('Cached portfolio breakdown by sector');
    }

    return breakdown;
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

    // Clear related cache since market data changed
    await Promise.all([
      this.clearPortfolioEntryCache(id),
      this.clearPortfolioCache(),
      // Also clear Yahoo Finance cache for this symbol since we fetched fresh data
      this.yahooFinanceService.clearSymbolCache(portfolioEntry.yahooSymbol),
    ]);

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

    // Clear all portfolio cache after bulk update
    // Also clear all Yahoo Finance cache since we updated all symbols
    await Promise.all([
      this.clearPortfolioCache(),
      this.yahooFinanceService.clearAllCache(),
    ]);

    this.logger.log(
      `Market data update completed: ${results.successful} successful, ${results.failed} failed`,
    );
    return results;
  }
}
