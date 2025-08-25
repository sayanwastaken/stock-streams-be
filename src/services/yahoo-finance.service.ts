import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';

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

  constructor() {
    // Configure axios defaults
    axios.defaults.timeout = this.timeout;
    axios.defaults.headers.common['User-Agent'] =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
  }

  /**
   * Get real-time quote data for a single symbol
   */
  async getQuote(symbol: string): Promise<YahooQuoteData> {
    try {
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

      return {
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
    try {
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

      return {
        symbol,
        peRatio,
        eps,
        forwardPE,
        marketCap,
        timestamp: new Date(),
      };
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
    try {
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

      return response.data.quotes
        .filter((quote: any) => quote.symbol && quote.shortname)
        .map((quote: any) => ({
          symbol: quote.symbol,
          name: quote.shortname || quote.longname,
        }));
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
}
