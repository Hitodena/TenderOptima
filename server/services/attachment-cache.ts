import * as crypto from 'crypto';
import { ProcessedAttachment } from './attachment-processor';

export interface CacheEntry {
  key: string;
  data: ProcessedAttachment;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  accessCount: number;
  lastAccessed: number;
}

export interface CacheStats {
  size: number;
  hitRate: number;
  missRate: number;
  totalAccesses: number;
  totalHits: number;
  totalMisses: number;
  oldestEntry: number;
  newestEntry: number;
}

export class AttachmentCache {
  private static instance: AttachmentCache;
  private cache: Map<string, CacheEntry> = new Map();
  private stats = {
    totalAccesses: 0,
    totalHits: 0,
    totalMisses: 0
  };
  private readonly defaultTTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly maxSize = 1000; // Maximum number of entries
  private cleanupInterval: NodeJS.Timeout | null = null;

  static getInstance(): AttachmentCache {
    if (!AttachmentCache.instance) {
      AttachmentCache.instance = new AttachmentCache();
    }
    return AttachmentCache.instance;
  }

  constructor() {
    // Запускаем периодическую очистку кеша
    this.startCleanup();
  }

  /**
   * Генерирует ключ кеша для вложения
   */
  private generateCacheKey(attachment: {
    filename: string;
    contentType: string;
    content: string;
    size: number;
  }): string {
    // Создаем хеш на основе содержимого файла для точного совпадения
    const contentHash = crypto
      .createHash('sha256')
      .update(attachment.content)
      .digest('hex')
      .substring(0, 16);
    
    return `${attachment.filename}_${attachment.contentType}_${attachment.size}_${contentHash}`;
  }

  /**
   * Получает данные из кеша
   */
  get(attachment: {
    filename: string;
    contentType: string;
    content: string;
    size: number;
  }): ProcessedAttachment | null {
    const key = this.generateCacheKey(attachment);
    const entry = this.cache.get(key);
    
    this.stats.totalAccesses++;
    
    if (!entry) {
      this.stats.totalMisses++;
      return null;
    }
    
    // Проверяем TTL
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.totalMisses++;
      return null;
    }
    
    // Обновляем статистику доступа
    entry.accessCount++;
    entry.lastAccessed = now;
    
    this.stats.totalHits++;
    return entry.data;
  }

  /**
   * Сохраняет данные в кеш
   */
  set(
    attachment: {
      filename: string;
      contentType: string;
      content: string;
      size: number;
    },
    data: ProcessedAttachment,
    ttl?: number
  ): void {
    const key = this.generateCacheKey(attachment);
    const now = Date.now();
    
    // Проверяем размер кеша
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }
    
    const entry: CacheEntry = {
      key,
      data,
      timestamp: now,
      ttl: ttl || this.defaultTTL,
      accessCount: 0,
      lastAccessed: now
    };
    
    this.cache.set(key, entry);
  }

  /**
   * Проверяет, есть ли данные в кеше
   */
  has(attachment: {
    filename: string;
    contentType: string;
    content: string;
    size: number;
  }): boolean {
    const key = this.generateCacheKey(attachment);
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }
    
    // Проверяем TTL
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Удаляет данные из кеша
   */
  delete(attachment: {
    filename: string;
    contentType: string;
    content: string;
    size: number;
  }): boolean {
    const key = this.generateCacheKey(attachment);
    return this.cache.delete(key);
  }

  /**
   * Очищает весь кеш
   */
  clear(): void {
    this.cache.clear();
    this.stats = {
      totalAccesses: 0,
      totalHits: 0,
      totalMisses: 0
    };
  }

  /**
   * Удаляет самые старые записи
   */
  private evictOldest(): void {
    let oldestKey = '';
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Очищает устаревшие записи
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
    
    console.log(`[AttachmentCache] Cleaned up ${keysToDelete.length} expired entries`);
  }

  /**
   * Запускает периодическую очистку
   */
  private startCleanup(): void {
    // Очистка каждые 30 минут
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 30 * 60 * 1000);
  }

  /**
   * Останавливает периодическую очистку
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Получает статистику кеша
   */
  getStats(): CacheStats {
    const now = Date.now();
    let oldestEntry = now;
    let newestEntry = 0;
    
    for (const entry of this.cache.values()) {
      if (entry.timestamp < oldestEntry) {
        oldestEntry = entry.timestamp;
      }
      if (entry.timestamp > newestEntry) {
        newestEntry = entry.timestamp;
      }
    }
    
    const hitRate = this.stats.totalAccesses > 0 
      ? this.stats.totalHits / this.stats.totalAccesses 
      : 0;
    
    const missRate = this.stats.totalAccesses > 0 
      ? this.stats.totalMisses / this.stats.totalAccesses 
      : 0;
    
    return {
      size: this.cache.size,
      hitRate,
      missRate,
      totalAccesses: this.stats.totalAccesses,
      totalHits: this.stats.totalHits,
      totalMisses: this.stats.totalMisses,
      oldestEntry: oldestEntry === now ? 0 : oldestEntry,
      newestEntry
    };
  }

  /**
   * Получает информацию о записях в кеше
   */
  getCacheInfo(): Array<{
    key: string;
    filename: string;
    timestamp: number;
    ttl: number;
    accessCount: number;
    lastAccessed: number;
    isExpired: boolean;
  }> {
    const now = Date.now();
    return Array.from(this.cache.values()).map(entry => ({
      key: entry.key,
      filename: entry.data.filename,
      timestamp: entry.timestamp,
      ttl: entry.ttl,
      accessCount: entry.accessCount,
      lastAccessed: entry.lastAccessed,
      isExpired: now - entry.timestamp > entry.ttl
    }));
  }

  /**
   * Удаляет устаревшие записи принудительно
   */
  forceCleanup(): number {
    const beforeSize = this.cache.size;
    this.cleanup();
    return beforeSize - this.cache.size;
  }

  /**
   * Устанавливает максимальный размер кеша
   */
  setMaxSize(maxSize: number): void {
    this.maxSize = maxSize;
    
    // Если текущий размер превышает новый максимум, удаляем лишние записи
    while (this.cache.size > maxSize) {
      this.evictOldest();
    }
  }

  /**
   * Устанавливает TTL по умолчанию
   */
  setDefaultTTL(ttl: number): void {
    this.defaultTTL = ttl;
  }
}

export const attachmentCache = AttachmentCache.getInstance();
