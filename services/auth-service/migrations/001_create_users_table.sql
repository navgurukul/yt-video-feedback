-- Migration: Create users table for Authentication Service
-- Description: Stores user information, encrypted API keys, and authentication data

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  supabase_id VARCHAR(255) UNIQUE,
  api_key TEXT, -- Encrypted Gemini API key (format: iv:authTag:encrypted)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_supabase_id ON users(supabase_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE users IS 'Stores user authentication data and encrypted API keys';
COMMENT ON COLUMN users.api_key IS 'AES-256-GCM encrypted Gemini API key (format: iv:authTag:encrypted)';
COMMENT ON COLUMN users.supabase_id IS 'User ID from Supabase authentication system';
