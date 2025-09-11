// Load environment variables first
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file
const envPath = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Enhanced WebSocket configuration with comprehensive error handling
class ErrorHandlingWebSocket extends ws {
  constructor(url: string | URL, protocols?: string | string[]) {
    super(url, protocols);
    
    // Override error handling to prevent the Neon library crash
    const originalEmit = this.emit;
    this.emit = function(event: string, ...args: any[]) {
      if (event === 'error') {
        console.warn('WebSocket connection error intercepted and handled gracefully');
        // Don't propagate error events that cause Neon crashes
        return false;
      }
      return originalEmit.call(this, event, ...args);
    };
  }
}

neonConfig.webSocketConstructor = ErrorHandlingWebSocket;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Optimized pool configuration for fast startup and better performance
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 5, // Increased for better performance
  min: 1, // Maintain minimum pool size
  idleTimeoutMillis: 30000, // Longer idle timeout for better connection reuse
  connectionTimeoutMillis: 10000, // Faster connection timeout for quick startup
  maxUses: 2000, // Less frequent connection recycling
  allowExitOnIdle: true, // Allow process to exit when all connections are idle
});

// Add pool error handlers for improved resilience
pool.on('error', (err, client) => {
  console.error('Database connection error:', err.message);
  // Don't crash the server on connection errors
});

// Handle Neon WebSocket connection errors more gracefully
neonConfig.pipelineConnect = false;
neonConfig.useSecureWebSocket = true;

pool.on('connect', (client) => {
  // Minimal logging to prevent startup delays
  if (process.env.NODE_ENV === 'development' && pool.totalCount === 1) {
    console.log('Database connected');
  }
});

pool.on('remove', (client) => {
  // Silent removal to prevent log spam
});

// Global error handler to prevent unhandled promise rejections in database operations
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in database operation:', promise, 'reason:', reason);
  // Application keeps running
});

export const db = drizzle({ client: pool, schema });

// Function to test the database connection
export async function testDatabaseConnection() {
  try {
    console.log('Testing database connection...');
    const result = await pool.query('SELECT NOW()');
    console.log('Database connection successful');
    return true;
  } catch (err) {
    console.error('Database connection test failed:', err instanceof Error ? err.message : String(err));
    return false;
  }
}

// Graceful shutdown function to clean up connections
export async function closeDatabasePool() {
  try {
    await pool.end();
    console.log('Database pool closed successfully');
  } catch (err) {
    console.error('Error closing database pool:', err instanceof Error ? err.message : String(err));
  }
}

// Add process handlers for graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT, closing database connections...');
  await closeDatabasePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, closing database connections...');
  await closeDatabasePool();
  process.exit(0);
});

// Test the connection on server startup with minimal logging
if (process.env.NODE_ENV === 'development') {
  testDatabaseConnection().catch(error => {
    console.error('Database connection failed:', error.message);
  });
}
