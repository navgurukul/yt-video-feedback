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

async function fixCustomEvaluationsTable() {
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
    
    if (!tableExists.rows[0].exists) {
      console.log('Table tbl_ailabs_ytfeedback_custom_evaluations does not exist');
      return;
    }

    // Check current column type
    const checkColumnQuery = `
      SELECT data_type, character_maximum_length 
      FROM information_schema.columns 
      WHERE table_name = 'tbl_ailabs_ytfeedback_custom_evaluations' 
      AND column_name = 'overall_assessment';
    `;
    
    const columnInfo = await client.query(checkColumnQuery);
    
    if (columnInfo.rows.length > 0) {
      const currentType = columnInfo.rows[0].data_type;
      const maxLength = columnInfo.rows[0].character_maximum_length;
      
      console.log(`Current overall_assessment column type: ${currentType}(${maxLength})`);
      
      if (currentType === 'character varying' && maxLength === 255) {
        console.log('Updating overall_assessment column from VARCHAR(255) to TEXT...');
        
        // Alter the column to TEXT
        const alterColumnQuery = `
          ALTER TABLE tbl_ailabs_ytfeedback_custom_evaluations 
          ALTER COLUMN overall_assessment TYPE TEXT;
        `;
        
        await client.query(alterColumnQuery);
        console.log('✓ Successfully updated overall_assessment column to TEXT');
      } else {
        console.log('Column is already the correct type or different than expected');
      }
    } else {
      console.log('overall_assessment column not found');
    }
    
  } catch (error) {
    console.error('Error fixing custom evaluations table:', error);
  } finally {
    await client.end();
  }
}

fixCustomEvaluationsTable();