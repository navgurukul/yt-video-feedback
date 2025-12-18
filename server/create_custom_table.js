import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pkg;

const client = new Client({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT || 5432,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
  ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

async function createCustomEvaluationsTable() {
  try {
    await client.connect();
    console.log('Connected to PostgreSQL database');

    // Check if table exists
    const checkTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'tbl_ailabs_ytfeedback_custom_evaluations'
      );
    `;
    
    const tableExists = await client.query(checkTableQuery);
    
    if (tableExists.rows[0].exists) {
      console.log('Table tbl_ailabs_ytfeedback_custom_evaluations already exists');
    } else {
      // Create the table
      const createTableQuery = `
        CREATE TABLE tbl_ailabs_ytfeedback_custom_evaluations (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          video_url TEXT NOT NULL,
          custom_prompt TEXT NOT NULL,
          custom_context TEXT,
          overall_assessment TEXT,
          criteria_analysis TEXT,
          custom_feedback TEXT,
          evaluation_json TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
      `;
      
      await client.query(createTableQuery);
      console.log('✓ Created table tbl_ailabs_ytfeedback_custom_evaluations');
      
      // Create indexes
      const createIndexes = [
        'CREATE INDEX idx_custom_evaluation_email ON tbl_ailabs_ytfeedback_custom_evaluations(email);',
        'CREATE INDEX idx_custom_evaluation_created_at ON tbl_ailabs_ytfeedback_custom_evaluations(created_at DESC);'
      ];
      
      for (const indexQuery of createIndexes) {
        await client.query(indexQuery);
      }
      
      console.log('✓ Created indexes for custom evaluations table');
    }
    
  } catch (error) {
    console.error('Error creating custom evaluations table:', error);
  } finally {
    await client.end();
  }
}

createCustomEvaluationsTable();