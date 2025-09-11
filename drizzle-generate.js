// Script to generate Drizzle migrations
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as schema from './shared/schema.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}

console.log('Generating Drizzle migrations...');

const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql, { schema });

async function generateMigrations() {
  try {
    // This will generate SQL files in the "drizzle" folder
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('✅ Migrations generated successfully');
  } catch (error) {
    console.error('❌ Failed to generate migrations:', error);
    process.exit(1);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

generateMigrations();