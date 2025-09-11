// Script to push database schema changes
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './shared/schema.js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';

const execPromise = promisify(exec);
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error(chalk.red('❌ DATABASE_URL environment variable is required'));
  process.exit(1);
}

console.log(chalk.blue('Connecting to database...'));

const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql, { schema });

async function runMigration() {
  try {
    console.log(chalk.blue('Applying schema changes...'));
    
    // Create migrations directory if it doesn't exist
    await execPromise('mkdir -p drizzle');
    
    // Push schema changes directly to the database
    await migrate(db, { migrationsFolder: './drizzle' });
    
    console.log(chalk.green('✅ Schema changes applied successfully'));
    
    // Log some info about the tables
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    console.log(chalk.blue('Database tables:'));
    tables.forEach(table => {
      console.log(`- ${table.table_name}`);
    });
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to apply schema changes:'), error);
    process.exit(1);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

runMigration();