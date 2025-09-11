// Direct database schema fix script
import postgres from 'postgres';
import chalk from 'chalk';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error(chalk.red('❌ DATABASE_URL environment variable is required'));
  process.exit(1);
}

console.log(chalk.blue('Connecting to database...'));

const sql = postgres(connectionString, { max: 1 });

// Tables that need userId column
const tablesToUpdate = [
  'suppliers',
  'request_parameters',
  'supplier_responses',
  'extracted_parameters',
  'contact_items',
  'email_requests',
  'request_supplier_groups',
  'request_supplier_messages'
];

async function updateTables() {
  try {
    console.log(chalk.blue('Checking existing tables...'));
    
    // Get current tables
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    console.log(chalk.blue('Database tables:'));
    tables.forEach(table => {
      console.log(`- ${table.table_name}`);
    });
    
    // Begin transaction
    await sql.begin(async (tx) => {
      console.log(chalk.blue('Adding userId columns to tables...'));
      
      for (const tableName of tablesToUpdate) {
        // Check if table exists and if it already has userId column
        const checkColumn = await tx`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = ${tableName} 
          AND column_name = 'user_id'
        `;
        
        if (checkColumn.length === 0) {
          console.log(chalk.yellow(`Adding user_id column to ${tableName}...`));
          
          // Add userId column (nullable at first)
          await tx`
            ALTER TABLE ${tx(tableName)} 
            ADD COLUMN IF NOT EXISTS user_id INTEGER
          `;
          
          // Add foreign key constraint
          await tx`
            ALTER TABLE ${tx(tableName)}
            ADD CONSTRAINT ${tx(`${tableName}_user_id_fkey`)}
            FOREIGN KEY (user_id) REFERENCES users(id)
            ON DELETE CASCADE
          `;
          
          console.log(chalk.green(`✅ Added user_id column to ${tableName}`));
        } else {
          console.log(chalk.blue(`Column user_id already exists in ${tableName}`));
        }
      }
      
      console.log(chalk.green('✅ Schema changes applied successfully'));
      
      // Populate userId column with data for testing (using user ID 1)
      console.log(chalk.blue('Populating userId data for existing records...'));
      
      for (const tableName of tablesToUpdate) {
        await tx`
          UPDATE ${tx(tableName)}
          SET user_id = 1
          WHERE user_id IS NULL
        `;
        console.log(chalk.green(`✅ Updated user_id values in ${tableName}`));
      }
    });
    
    console.log(chalk.green('✅ Database schema update completed!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to update schema:'), error);
    process.exit(1);
  } finally {
    await sql.end();
    process.exit(0);
  }
}

updateTables();