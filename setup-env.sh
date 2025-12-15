#!/bin/bash

# Setup wizard for configuring environment variables

set -e

ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo "================================================"
echo "  Environment Configuration Wizard"
echo "================================================"
echo ""

# Function to prompt for value with default
prompt_with_default() {
    local prompt_text=$1
    local default_value=$2
    local secret=$3
    
    if [ "$secret" = "true" ]; then
        read -sp "$prompt_text [$default_value]: " value
        echo ""
    else
        read -p "$prompt_text [$default_value]: " value
    fi
    
    echo "${value:-$default_value}"
}

# Check if user wants to configure
echo -e "${YELLOW}This wizard will help you configure database credentials and secrets.${NC}"
echo ""
echo "Do you have database credentials to configure?"
echo "  1) Yes, I'll enter them now"
echo "  2) No, skip for now (services won't start without valid credentials)"
echo "  3) Use existing server/.env credentials"
echo ""
read -p "Choose option [1-3]: " choice

if [ "$choice" = "3" ]; then
    # Copy credentials from server/.env to auth-service/.env
    echo ""
    echo -e "${BLUE}Copying database credentials from server/.env...${NC}"
    
    if [ -f "$ROOT_DIR/server/.env" ]; then
        PG_HOST=$(grep "^PG_HOST=" "$ROOT_DIR/server/.env" | cut -d '=' -f2)
        PG_PORT=$(grep "^PG_PORT=" "$ROOT_DIR/server/.env" | cut -d '=' -f2)
        PG_USER=$(grep "^PG_USER=" "$ROOT_DIR/server/.env" | cut -d '=' -f2)
        PG_PASSWORD=$(grep "^PG_PASSWORD=" "$ROOT_DIR/server/.env" | cut -d '=' -f2)
        PG_DATABASE=$(grep "^PG_DATABASE=" "$ROOT_DIR/server/.env" | cut -d '=' -f2)
        PG_SSL=$(grep "^PG_SSL=" "$ROOT_DIR/server/.env" | cut -d '=' -f2)
        
        echo -e "${GREEN}✅ Found existing credentials${NC}"
    else
        echo -e "${RED}❌ server/.env not found${NC}"
        exit 1
    fi
elif [ "$choice" = "2" ]; then
    echo ""
    echo -e "${YELLOW}Skipping configuration. Please edit .env files manually:${NC}"
    echo "  • services/auth-service/.env"
    echo "  • server/.env"
    echo "  • .env (frontend)"
    exit 0
else
    # Prompt for database credentials
    echo ""
    echo -e "${BLUE}Database Configuration${NC}"
    echo "Enter your PostgreSQL database credentials:"
    echo ""
    
    PG_HOST=$(prompt_with_default "Database Host" "localhost")
    PG_PORT=$(prompt_with_default "Database Port" "5432")
    PG_USER=$(prompt_with_default "Database User" "postgres")
    PG_PASSWORD=$(prompt_with_default "Database Password" "" "true")
    PG_DATABASE=$(prompt_with_default "Database Name" "ytfeedback")
    PG_SSL=$(prompt_with_default "Use SSL? (true/false)" "true")
fi

# Generate secrets for auth service
echo ""
echo -e "${BLUE}Generating secrets for Auth Service...${NC}"
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo -e "${GREEN}✅ Secrets generated${NC}"

# Update auth-service/.env
echo ""
echo -e "${BLUE}Updating services/auth-service/.env...${NC}"
cat > "$ROOT_DIR/services/auth-service/.env" << EOF
# Environment Configuration for Auth Service

# Server Configuration
AUTH_SERVICE_PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000

# Database Configuration (PostgreSQL)
PG_HOST=$PG_HOST
PG_PORT=$PG_PORT
PG_USER=$PG_USER
PG_PASSWORD=$PG_PASSWORD
PG_DATABASE=$PG_DATABASE
PG_SSL=$PG_SSL

# JWT Configuration
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d

# Encryption Configuration (for API keys)
ENCRYPTION_KEY=$ENCRYPTION_KEY
EOF
echo -e "${GREEN}✅ Auth service configured${NC}"

# Update server/.env
echo ""
echo -e "${BLUE}Updating server/.env...${NC}"
cat > "$ROOT_DIR/server/.env" << EOF
# Backend Environment Variables

# Gemini AI API Key (Optional - users can provide their own via frontend)
# Get your key from: https://aistudio.google.com/apikey
GEMINI_API_KEY=${GEMINI_API_KEY:-your_gemini_api_key_here}

# PostgreSQL Database Configuration
PG_HOST=$PG_HOST
PG_PORT=$PG_PORT
PG_USER=$PG_USER
PG_PASSWORD=$PG_PASSWORD
PG_DATABASE=$PG_DATABASE
PG_SSL=$PG_SSL

# Server Configuration
PORT=3003
EOF
echo -e "${GREEN}✅ Evaluation service configured${NC}"

# Check frontend .env
echo ""
echo -e "${BLUE}Checking frontend configuration...${NC}"
if [ ! -f "$ROOT_DIR/.env" ]; then
    cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
    echo -e "${YELLOW}⚠️  Created .env from template${NC}"
    echo -e "${YELLOW}   Please edit .env and add your Supabase credentials${NC}"
else
    echo -e "${GREEN}✅ Frontend .env exists${NC}"
fi

# Test database connection
echo ""
echo -e "${BLUE}Testing database connection...${NC}"
node -e "
const { Pool } = require('pg');
const pool = new Pool({
    host: '$PG_HOST',
    port: $PG_PORT,
    user: '$PG_USER',
    password: '$PG_PASSWORD',
    database: '$PG_DATABASE',
    ssl: '$PG_SSL' === 'true' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 5000
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
        process.exit(1);
    } else {
        console.log('✅ Database connection successful');
        pool.end();
        process.exit(0);
    }
});
" && DB_OK=true || DB_OK=false

echo ""
if [ "$DB_OK" = true ]; then
    echo -e "${GREEN}================================================${NC}"
    echo -e "${GREEN}  ✅ Configuration Complete!${NC}"
    echo -e "${GREEN}================================================${NC}"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "  1. Run database migration:"
    echo "     psql -h $PG_HOST -U $PG_USER -d $PG_DATABASE -f services/auth-service/migrations/001_create_users_table.sql"
    echo ""
    echo "  2. Start all services:"
    echo "     ./start-all.sh"
    echo ""
else
    echo -e "${YELLOW}================================================${NC}"
    echo -e "${YELLOW}  ⚠️  Configuration Complete (with warnings)${NC}"
    echo -e "${YELLOW}================================================${NC}"
    echo ""
    echo -e "${RED}Database connection test failed.${NC}"
    echo "Please verify your credentials and try again."
    echo ""
    echo "To reconfigure, run: ./setup-env.sh"
fi
