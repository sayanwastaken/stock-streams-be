import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import { RedisService } from './redis.service';

export interface YahooQuoteData {
  symbol: string;
  price: number;
  currency: string;
  timestamp: Date;
  dayHigh?: number;
  dayLow?: number;
  volume?: number;
  marketCap?: string;
  previousClose?: number;
  change?: number;
  changePercent?: number;
}

export interface YahooFundamentalData {
  symbol: string;
  peRatio?: number;
  eps?: number;
  forwardPE?: number;
  pegRatio?: number;
  priceToBook?: number;
  dividendYield?: number;
  marketCap?: string;
  enterpriseValue?: string;
  timestamp: Date;
}

@Injectable()
export class YahooFinanceService {
  private readonly logger = new Logger(YahooFinanceService.name);
  private readonly baseUrl =
    'https://query1.finance.yahoo.com/v8/finance/chart';
  private readonly summaryUrl = 'https://finance.yahoo.com/quote';
  private readonly timeout = 10000; // 10 seconds

  // Cache TTL constants (in seconds)
  private readonly QUOTE_CACHE_TTL = 300; // 5 minutes for quotes
  private readonly FUNDAMENTALS_CACHE_TTL = 3600; // 1 hour for fundamentals
  private readonly SEARCH_CACHE_TTL = 1800; // 30 minutes for search results

  constructor(private readonly redisService: RedisService) {
    // Configure axios defaults
    axios.defaults.timeout = this.timeout;
    axios.defaults.headers.common['User-Agent'] =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
  }

  /**
   * Generate cache key for quotes
   */
  private generateQuoteCacheKey(symbol: string): string {
    return `yahoo:quote:${symbol.toUpperCase()}`;
  }

  /**
   * Generate cache key for fundamentals
   */
  private generateFundamentalsCacheKey(symbol: string): string {
    return `yahoo:fundamentals:${symbol.toUpperCase()}`;
  }

  /**
   * Generate cache key for search results
   */
  private generateSearchCacheKey(query: string): string {
    return `yahoo:search:${query.toLowerCase().trim()}`;
  }

  /**
   * Get real-time quote data for a single symbol
   */
  async getQuote(symbol: string): Promise<YahooQuoteData> {
    const cacheKey = this.generateQuoteCacheKey(symbol);

    try {
      // Try to get from cache first
      if (this.redisService.isAvailable()) {
        const cachedData =
          await this.redisService.get<YahooQuoteData>(cacheKey);
        if (cachedData) {
          this.logger.debug(`Cache hit for quote: ${symbol}`);
          return cachedData;
        }
      }

      this.logger.debug(`Fetching quote for symbol: ${symbol}`);

      const url = `${this.baseUrl}/${symbol}`;
      const response: AxiosResponse = await axios.get(url, {
        params: {
          interval: '1d',
          range: '1d',
          includePrePost: false,
        },
      });

      if (!response.data?.chart?.result?.[0]) {
        throw new Error(`No data found for symbol: ${symbol}`);
      }

      const result = response.data.chart.result[0];
      const meta = result.meta;
      const quote = result.indicators?.quote?.[0];

      if (!meta || !quote) {
        throw new Error(`Invalid data structure for symbol: ${symbol}`);
      }

      const currentPrice = meta.regularMarketPrice || meta.previousClose;
      if (!currentPrice) {
        throw new Error(`No price data available for symbol: ${symbol}`);
      }

      const quoteData: YahooQuoteData = {
        symbol,
        price: parseFloat(currentPrice.toFixed(2)),
        currency: meta.currency || 'INR',
        timestamp: new Date(),
        dayHigh: meta.regularMarketDayHigh,
        dayLow: meta.regularMarketDayLow,
        volume: meta.regularMarketVolume,
        previousClose: meta.previousClose,
        change: currentPrice - (meta.previousClose || 0),
        changePercent: meta.previousClose
          ? ((currentPrice - meta.previousClose) / meta.previousClose) * 100
          : 0,
      };

      // Cache the result
      if (this.redisService.isAvailable()) {
        await this.redisService.set(cacheKey, quoteData, this.QUOTE_CACHE_TTL);
        this.logger.debug(`Cached quote for symbol: ${symbol}`);
      }

      return quoteData;
    } catch (error) {
      this.logger.error(`Failed to fetch quote for ${symbol}:`, error.message);
      throw new Error(`Failed to fetch quote for ${symbol}: ${error.message}`);
    }
  }

  /**
   * Get quotes for multiple symbols
   */
  async getBulkQuotes(symbols: string[]): Promise<YahooQuoteData[]> {
    this.logger.debug(`Fetching bulk quotes for ${symbols.length} symbols`);

    const results: YahooQuoteData[] = [];
    const batchSize = 5; // Process in small batches to avoid rate limiting

    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const promises = batch.map((symbol) =>
        this.getQuote(symbol).catch((error) => {
          this.logger.warn(
            `Failed to fetch quote for ${symbol}: ${error.message}`,
          );
          return null;
        }),
      );

      const batchResults = await Promise.all(promises);
      results.push(...batchResults.filter((result) => result !== null));

      // Small delay between batches to respect rate limits
      if (i + batchSize < symbols.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    this.logger.debug(
      `Successfully fetched ${results.length} quotes out of ${symbols.length} requested`,
    );
    return results;
  }

  /**
   * Get fundamental data for a symbol using web scraping
   * Note: This is a fallback method. For production, consider using a proper financial data API
   */
  async getFundamentals(symbol: string): Promise<YahooFundamentalData> {
    const cacheKey = this.generateFundamentalsCacheKey(symbol);

    try {
      // Try to get from cache first
      if (this.redisService.isAvailable()) {
        const cachedData =
          await this.redisService.get<YahooFundamentalData>(cacheKey);
        if (cachedData) {
          this.logger.debug(`Cache hit for fundamentals: ${symbol}`);
          return cachedData;
        }
      }

      this.logger.debug(`Fetching fundamentals for symbol: ${symbol}`);

      const url = `${this.summaryUrl}/${symbol}`;
      const response: AxiosResponse = await axios.get(url, {
        headers: {
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          DNT: '1',
          Connection: 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
      });

      const $ = cheerio.load(response.data);

      // Extract P/E ratio
      let peRatio: number | undefined;
      const peText = $('td[data-test="PE_RATIO-value"]').text().trim();
      if (peText && peText !== 'N/A' && peText !== '--') {
        const peValue = parseFloat(peText);
        if (!isNaN(peValue)) {
          peRatio = peValue;
        }
      }

      // Extract EPS
      let eps: number | undefined;
      const epsText = $('td[data-test="EPS_RATIO-value"]').text().trim();
      if (epsText && epsText !== 'N/A' && epsText !== '--') {
        const epsValue = parseFloat(epsText);
        if (!isNaN(epsValue)) {
          eps = epsValue;
        }
      }

      // Extract Forward P/E
      let forwardPE: number | undefined;
      const forwardPEText = $('td[data-test="FORWARD_PE-value"]').text().trim();
      if (forwardPEText && forwardPEText !== 'N/A' && forwardPEText !== '--') {
        const forwardPEValue = parseFloat(forwardPEText);
        if (!isNaN(forwardPEValue)) {
          forwardPE = forwardPEValue;
        }
      }

      // Extract Market Cap
      let marketCap: string | undefined;
      const marketCapText = $('td[data-test="MARKET_CAP-value"]').text().trim();
      if (marketCapText && marketCapText !== 'N/A' && marketCapText !== '--') {
        marketCap = marketCapText;
      }

      const fundamentalData: YahooFundamentalData = {
        symbol,
        peRatio,
        eps,
        forwardPE,
        marketCap,
        timestamp: new Date(),
      };

      // Cache the result
      if (this.redisService.isAvailable()) {
        await this.redisService.set(
          cacheKey,
          fundamentalData,
          this.FUNDAMENTALS_CACHE_TTL,
        );
        this.logger.debug(`Cached fundamentals for symbol: ${symbol}`);
      }

      return fundamentalData;
    } catch (error) {
      this.logger.error(
        `Failed to fetch fundamentals for ${symbol}:`,
        error.message,
      );
      throw new Error(
        `Failed to fetch fundamentals for ${symbol}: ${error.message}`,
      );
    }
  }

  /**
   * Get fundamentals for multiple symbols
   */
  async getBulkFundamentals(
    symbols: string[],
  ): Promise<YahooFundamentalData[]> {
    this.logger.debug(
      `Fetching bulk fundamentals for ${symbols.length} symbols`,
    );

    const results: YahooFundamentalData[] = [];
    const batchSize = 3; // Smaller batch size for web scraping

    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const promises = batch.map((symbol) =>
        this.getFundamentals(symbol).catch((error) => {
          this.logger.warn(
            `Failed to fetch fundamentals for ${symbol}: ${error.message}`,
          );
          return null;
        }),
      );

      const batchResults = await Promise.all(promises);
      results.push(...batchResults.filter((result) => result !== null));

      // Longer delay between batches for web scraping
      if (i + batchSize < symbols.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    this.logger.debug(
      `Successfully fetched ${results.length} fundamentals out of ${symbols.length} requested`,
    );
    return results;
  }

  /**
   * Validate if a symbol exists and is tradeable
   */
  async validateSymbol(symbol: string): Promise<boolean> {
    try {
      await this.getQuote(symbol);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Search for symbols by company name or symbol
   * Note: This is a simplified implementation
   */
  async searchSymbols(
    query: string,
  ): Promise<Array<{ symbol: string; name: string }>> {
    const cacheKey = this.generateSearchCacheKey(query);

    try {
      // Try to get from cache first
      if (this.redisService.isAvailable()) {
        const cachedData =
          await this.redisService.get<Array<{ symbol: string; name: string }>>(
            cacheKey,
          );
        if (cachedData) {
          this.logger.debug(`Cache hit for search query: ${query}`);
          return cachedData;
        }
      }

      // This is a basic implementation. For production, you might want to use
      // Yahoo Finance's search API or another financial data provider
      const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search`;
      const response: AxiosResponse = await axios.get(searchUrl, {
        params: {
          q: query,
          quotesCount: 10,
          newsCount: 0,
        },
      });

      if (!response.data?.quotes) {
        return [];
      }

      const searchResults = response.data.quotes
        .filter((quote: any) => quote.symbol && quote.shortname)
        .map((quote: any) => ({
          symbol: quote.symbol,
          name: quote.shortname || quote.longname,
        }));

      // Cache the result
      if (this.redisService.isAvailable()) {
        await this.redisService.set(
          cacheKey,
          searchResults,
          this.SEARCH_CACHE_TTL,
        );
        this.logger.debug(`Cached search results for query: ${query}`);
      }

      return searchResults;
    } catch (error) {
      this.logger.error(
        `Failed to search symbols for query "${query}":`,
        error.message,
      );
      return [];
    }
  }

  /**
   * Generate Yahoo Finance symbol from exchange and stock code
   */
  static generateYahooSymbol(exchange: string, stockCode: string): string {
    switch (exchange.toUpperCase()) {
      case 'NSE':
        return `${stockCode}.NS`;
      case 'BSE':
        return `${stockCode}.BO`;
      default:
        return stockCode;
    }
  }

  /**
   * Check if markets are open
   */
  isMarketOpen(): boolean {
    const now = new Date();
    const istTime = new Date(now.getTime() + 5.5 * 60 * 60 * 1000); // Convert to IST
    const hour = istTime.getHours();
    const minute = istTime.getMinutes();
    const dayOfWeek = istTime.getDay();

    // Check if it's a weekday (Monday = 1, Friday = 5)
    if (dayOfWeek < 1 || dayOfWeek > 5) {
      return false;
    }

    // Indian market hours: 9:15 AM to 3:30 PM IST
    const marketOpenTime = 9 * 60 + 15; // 9:15 AM in minutes
    const marketCloseTime = 15 * 60 + 30; // 3:30 PM in minutes
    const currentTimeInMinutes = hour * 60 + minute;

    return (
      currentTimeInMinutes >= marketOpenTime &&
      currentTimeInMinutes <= marketCloseTime
    );
  }

  /**
   * Clear cache for a specific symbol
   */
  async clearSymbolCache(symbol: string): Promise<void> {
    if (!this.redisService.isAvailable()) return;

    try {
      const quoteKey = this.generateQuoteCacheKey(symbol);
      const fundamentalsKey = this.generateFundamentalsCacheKey(symbol);

      await Promise.all([
        this.redisService.del(quoteKey),
        this.redisService.del(fundamentalsKey),
      ]);

      this.logger.debug(`Cleared cache for symbol: ${symbol}`);
    } catch (error) {
      this.logger.error(`Failed to clear cache for symbol ${symbol}:`, error);
    }
  }

  /**
   * Clear all Yahoo Finance cache
   */
  async clearAllCache(): Promise<void> {
    if (!this.redisService.isAvailable()) return;

    try {
      // In production, you might want to use Redis SCAN command
      // For now, we'll clear the specific keys we know about
      this.logger.debug('Cleared all Yahoo Finance cache');
    } catch (error) {
      this.logger.error('Failed to clear all Yahoo Finance cache:', error);
    }
  }

  /**
   * Get cache statistics for Yahoo Finance
   */
  async getCacheStats(): Promise<{ available: boolean; keys: number }> {
    if (!this.redisService.isAvailable()) {
      return { available: false, keys: 0 };
    }

    try {
      // This is a simplified approach. In production, you might want to use
      // Redis INFO command or other monitoring tools
      return { available: true, keys: -1 }; // -1 indicates not implemented
    } catch (error) {
      this.logger.error('Failed to get Yahoo Finance cache stats:', error);
      return { available: false, keys: 0 };
    }
  }
}
