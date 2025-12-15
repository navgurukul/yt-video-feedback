-- Migration: Add RLS (Row Level Security) policies for users table
-- Description: Ensures users can only access their own data

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own data
CREATE POLICY users_select_own 
ON users FOR SELECT 
USING (email = current_setting('app.current_user_email', true));

-- Policy: Users can update their own data
CREATE POLICY users_update_own 
ON users FOR UPDATE 
USING (email = current_setting('app.current_user_email', true));

-- Policy: Service can insert new users (bypass RLS for service role)
CREATE POLICY users_insert_service 
ON users FOR INSERT 
WITH CHECK (true);

-- Note: In production, you should use proper service role authentication
-- For now, the application will connect with a user that has appropriate permissions
