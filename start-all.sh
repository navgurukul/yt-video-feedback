#!/bin/bash

# YouTube Video Feedback - Complete Startup Script
# This script sets up and runs all three services with proper port configuration

set -e  # Exit on error

echo "================================================"
echo "  YouTube Video Feedback - Startup Script"
echo "================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Root directory
ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Function to check if port is available
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        echo -e "${RED}❌ Port $port is already in use${NC}"
        echo "   Please kill the process using: lsof -ti:$port | xargs kill -9"
        return 1
    else
        echo -e "${GREEN}✅ Port $port is available${NC}"
        return 0
    fi
}

# Check if .env files exist
echo -e "${BLUE}Checking configuration files...${NC}"
echo ""

# Check Auth Service .env
if [ ! -f "$ROOT_DIR/services/auth-service/.env" ]; then
    echo -e "${YELLOW}⚠️  Auth Service .env not found${NC}"
    echo "   Creating from template..."
    cp "$ROOT_DIR/services/auth-service/.env.example" "$ROOT_DIR/services/auth-service/.env"
    echo -e "${GREEN}   Created services/auth-service/.env${NC}"
    echo -e "${YELLOW}   ⚠️  IMPORTANT: Edit services/auth-service/.env with your database credentials${NC}"
    echo ""
fi

# Check Evaluation Service .env
if [ ! -f "$ROOT_DIR/server/.env" ]; then
    echo -e "${YELLOW}⚠️  Evaluation Service .env not found${NC}"
    echo "   Creating from template..."
    cp "$ROOT_DIR/server/.env.example" "$ROOT_DIR/server/.env"
    echo -e "${GREEN}   Created server/.env${NC}"
    echo -e "${YELLOW}   ⚠️  IMPORTANT: Edit server/.env with your database credentials${NC}"
    echo ""
fi

# Check Frontend .env
if [ ! -f "$ROOT_DIR/.env" ]; then
    echo -e "${YELLOW}⚠️  Frontend .env not found${NC}"
    echo "   Creating from template..."
    cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
    echo -e "${GREEN}   Created .env${NC}"
    echo -e "${YELLOW}   ⚠️  IMPORTANT: Edit .env with your Supabase credentials${NC}"
    echo ""
fi

# Check port availability
echo -e "${BLUE}Checking port availability...${NC}"
PORTS_OK=true
check_port 3001 || PORTS_OK=false  # Auth Service
check_port 3003 || PORTS_OK=false  # Evaluation Service
check_port 3000 || PORTS_OK=false  # Frontend (Vite default) or 8080

echo ""

if [ "$PORTS_OK" = false ]; then
    echo -e "${RED}Cannot start services - ports are in use${NC}"
    exit 1
fi

# Check if dependencies are installed
echo -e "${BLUE}Checking dependencies...${NC}"

if [ ! -d "$ROOT_DIR/services/auth-service/node_modules" ]; then
    echo "   Installing Auth Service dependencies..."
    cd "$ROOT_DIR/services/auth-service"
    npm install
    cd "$ROOT_DIR"
fi

if [ ! -d "$ROOT_DIR/server/node_modules" ]; then
    echo "   Installing Evaluation Service dependencies..."
    cd "$ROOT_DIR/server"
    npm install
    cd "$ROOT_DIR"
fi

if [ ! -d "$ROOT_DIR/node_modules" ]; then
    echo "   Installing Frontend dependencies..."
    npm install
fi

echo -e "${GREEN}✅ All dependencies installed${NC}"
echo ""

# Database migration check
echo -e "${YELLOW}⚠️  IMPORTANT: Database Migration${NC}"
echo "   Have you run the database migration for the users table?"
echo "   File: services/auth-service/migrations/001_create_users_table.sql"
echo ""
echo "   If not, run:"
echo "   psql -h your-host -U your-user -d your-database -f services/auth-service/migrations/001_create_users_table.sql"
echo ""
read -p "Press Enter to continue (or Ctrl+C to abort)..."
echo ""

# Start services
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Starting Services${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

echo -e "${GREEN}📦 Service Configuration:${NC}"
echo "   • Auth Service:       http://localhost:3001"
echo "   • Evaluation Service: http://localhost:3003"
echo "   • Frontend:           http://localhost:3000 (or 8080)"
echo ""

# Create log directory
mkdir -p "$ROOT_DIR/logs"

echo -e "${BLUE}Starting services in background...${NC}"
echo ""

# Start Auth Service
echo -e "${GREEN}1️⃣  Starting Auth Service (port 3001)...${NC}"
cd "$ROOT_DIR/services/auth-service"
nohup npm start > "$ROOT_DIR/logs/auth-service.log" 2>&1 &
AUTH_PID=$!
echo "   PID: $AUTH_PID"
echo "   Logs: logs/auth-service.log"
sleep 3

# Check if auth service started successfully
if ! ps -p $AUTH_PID > /dev/null; then
    echo -e "${RED}   ❌ Auth Service failed to start${NC}"
    echo "   Check logs: cat logs/auth-service.log"
    exit 1
fi
echo -e "${GREEN}   ✅ Auth Service started${NC}"
echo ""

# Start Evaluation Service
echo -e "${GREEN}2️⃣  Starting Evaluation Service (port 3003)...${NC}"
cd "$ROOT_DIR/server"
nohup npm start > "$ROOT_DIR/logs/evaluation-service.log" 2>&1 &
EVAL_PID=$!
echo "   PID: $EVAL_PID"
echo "   Logs: logs/evaluation-service.log"
sleep 3

# Check if evaluation service started successfully
if ! ps -p $EVAL_PID > /dev/null; then
    echo -e "${RED}   ❌ Evaluation Service failed to start${NC}"
    echo "   Check logs: cat logs/evaluation-service.log"
    kill $AUTH_PID 2>/dev/null
    exit 1
fi
echo -e "${GREEN}   ✅ Evaluation Service started${NC}"
echo ""

# Start Frontend
echo -e "${GREEN}3️⃣  Starting Frontend (port 3000/8080)...${NC}"
cd "$ROOT_DIR"
nohup npm run dev > "$ROOT_DIR/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "   PID: $FRONTEND_PID"
echo "   Logs: logs/frontend.log"
sleep 3

# Check if frontend started successfully
if ! ps -p $FRONTEND_PID > /dev/null; then
    echo -e "${RED}   ❌ Frontend failed to start${NC}"
    echo "   Check logs: cat logs/frontend.log"
    kill $AUTH_PID $EVAL_PID 2>/dev/null
    exit 1
fi
echo -e "${GREEN}   ✅ Frontend started${NC}"
echo ""

# Save PIDs to file for cleanup
echo "$AUTH_PID" > "$ROOT_DIR/logs/pids.txt"
echo "$EVAL_PID" >> "$ROOT_DIR/logs/pids.txt"
echo "$FRONTEND_PID" >> "$ROOT_DIR/logs/pids.txt"

# Health checks
echo -e "${BLUE}================================================${NC}"
echo -e "${BLUE}  Health Checks${NC}"
echo -e "${BLUE}================================================${NC}"
echo ""

sleep 2

# Check Auth Service
echo -n "Testing Auth Service... "
if curl -s http://localhost:3001/auth/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${YELLOW}⚠️  Not responding yet (may need more time)${NC}"
fi

# Check Evaluation Service
echo -n "Testing Evaluation Service... "
if curl -s http://localhost:3003/ > /dev/null 2>&1; then
    echo -e "${GREEN}✅ OK${NC}"
else
    echo -e "${YELLOW}⚠️  Not responding yet (may need more time)${NC}"
fi

# Check Frontend
echo -n "Testing Frontend... "
if curl -s http://localhost:3000/ > /dev/null 2>&1; then
    echo -e "${GREEN}✅ OK (port 3000)${NC}"
elif curl -s http://localhost:8080/ > /dev/null 2>&1; then
    echo -e "${GREEN}✅ OK (port 8080)${NC}"
else
    echo -e "${YELLOW}⚠️  Not responding yet (may need more time)${NC}"
fi

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  🎉 All Services Started Successfully!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "${BLUE}Access Points:${NC}"
echo "   • Auth Service:       http://localhost:3001/auth/health"
echo "   • Evaluation Service: http://localhost:3003"
echo "   • Frontend:           http://localhost:3000 or http://localhost:8080"
echo ""
echo -e "${BLUE}Logs:${NC}"
echo "   • Auth Service:       tail -f logs/auth-service.log"
echo "   • Evaluation Service: tail -f logs/evaluation-service.log"
echo "   • Frontend:           tail -f logs/frontend.log"
echo ""
echo -e "${BLUE}To stop all services:${NC}"
echo "   ./stop-services.sh"
echo "   (or manually: kill $AUTH_PID $EVAL_PID $FRONTEND_PID)"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop monitoring (services will continue running in background)${NC}"
echo ""

# Monitor logs
echo -e "${BLUE}Monitoring logs (Ctrl+C to exit)...${NC}"
echo ""
tail -f "$ROOT_DIR/logs/auth-service.log" "$ROOT_DIR/logs/evaluation-service.log" "$ROOT_DIR/logs/frontend.log"
