import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private redisClient: RedisClientType | null = null;

  constructor(private configService: ConfigService) {
    this.initializeRedis();
  }

  private async initializeRedis() {
    try {
      this.redisClient = createClient({
        socket: {
          host: this.configService.get<string>('redis.host'),
          port: this.configService.get<number>('redis.port'),
        },
        password: this.configService.get<string>('redis.password'),
        database: this.configService.get<number>('redis.db'),
      });

      this.redisClient.on('error', (err) => {
        this.logger.error('Redis Client Error:', err);
      });

      this.redisClient.on('connect', () => {
        this.logger.log('Redis Client Connected');
      });

      await this.redisClient.connect();
    } catch (error) {
      this.logger.error('Failed to initialize Redis:', error);
      // Fallback to no caching if Redis is not available
      this.redisClient = null;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.redisClient) return null;

    try {
      const value = await this.redisClient.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error(`Failed to get key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    if (!this.redisClient) return;

    try {
      const serializedValue = JSON.stringify(value);
      if (ttlSeconds) {
        await this.redisClient.setEx(key, ttlSeconds, serializedValue);
      } else {
        await this.redisClient.set(key, serializedValue);
      }
    } catch (error) {
      this.logger.error(`Failed to set key ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.redisClient) return;

    try {
      await this.redisClient.del(key);
    } catch (error) {
      this.logger.error(`Failed to delete key ${key}:`, error);
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.redisClient) return false;

    try {
      const result = await this.redisClient.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to check existence of key ${key}:`, error);
      return false;
    }
  }

  async flushDb(): Promise<void> {
    if (!this.redisClient) return;

    try {
      await this.redisClient.flushDb();
      this.logger.log('Redis database flushed');
    } catch (error) {
      this.logger.error('Failed to flush Redis database:', error);
    }
  }

  async onModuleDestroy() {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }

  isAvailable(): boolean {
    return this.redisClient !== null;
  }
}
