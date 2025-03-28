const { Pool } = require('pg');
const dotenv = require('dotenv');

// Ensure environment variables are loaded
if (!process.env.DATABASE_PASSWORD) {
  dotenv.config({
    path: './config.env'
  });
}

// Create a PostgreSQL connection pool with increased timeout values
const pgPool = new Pool({
  connectionString: process.env.PG_CONNECTION_STRING,
  // Enable SSL for hosted databases
  ssl: {
    rejectUnauthorized: false
  },
  // Connection pool settings
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased from 2000ms to 10000ms (10 seconds)
  // Add retries
  retryAttempts: 3,
});

// Handle pool errors
pgPool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

// Initialize connection with retry logic
const initializePostgres = async (retries = 3, delay = 3000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`PostgreSQL connection attempt ${attempt}/${retries}...`);
      
      // Get client from pool
      const client = await pgPool.connect();
      
      console.log('PostgreSQL connection successful');
      
      // Test query
      const result = await client.query('SELECT NOW() as current_time');
      console.log(`PostgreSQL server time: ${result.rows[0].current_time}`);
      
      // Release client
      client.release();
      return true;
    } catch (err) {
      console.error(`PostgreSQL connection error (attempt ${attempt}/${retries}):`, err.message);
      
      if (attempt < retries) {
        console.log(`Retrying in ${delay/1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('All PostgreSQL connection attempts failed');
        return false;
      }
    }
  }
  return false;
};

// Query execution helper with timeout and retry
const query = async (text, params, maxRetries = 1) => {
  let retries = 0;
  
  while (retries <= maxRetries) {
    try {
      const result = await pgPool.query(text, params);
      return result;
    } catch (err) {
      retries++;
      if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
        if (retries <= maxRetries) {
          console.log(`Query connection failed. Retry attempt ${retries}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
      }
      console.error('Error executing query:', err);
      throw err;
    }
  }
};

// Close pool
const closePool = async () => {
  try {
    await pgPool.end();
    console.log('PostgreSQL pool has ended');
  } catch (err) {
    console.error('Error closing PostgreSQL pool:', err);
  }
};

// Check if database is reachable
const isConnected = async () => {
  try {
    const client = await pgPool.connect();
    client.release();
    return true;
  } catch (err) {
    return false;
  }
};

module.exports = {
  pgPool,
  query,
  initializePostgres,
  closePool,
  isConnected
};