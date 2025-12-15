#!/bin/bash

# Phase 1: Quick Start Script
# This script helps you run the Authentication Service and check prerequisites

set -e  # Exit on error

echo "================================================"
echo "  Phase 1: Authentication Service Quick Start"
echo "================================================"
echo ""

# Check if .env exists in auth service
if [ ! -f "services/auth-service/.env" ]; then
    echo "❌ Error: services/auth-service/.env not found"
    echo ""
    echo "Please create .env file from template:"
    echo "  cd services/auth-service"
    echo "  cp .env.example .env"
    echo "  # Edit .env with your configuration"
    echo ""
    exit 1
fi

# Check if node_modules exists
if [ ! -d "services/auth-service/node_modules" ]; then
    echo "📦 Installing dependencies..."
    cd services/auth-service
    npm install
    cd ../..
    echo "✅ Dependencies installed"
    echo ""
fi

# Check if database migration has been run
echo "⚠️  Important: Have you run the database migration?"
echo "   File: services/auth-service/migrations/001_create_users_table.sql"
echo ""
read -p "Press Enter to continue (or Ctrl+C to abort)..."
echo ""

# Start the auth service
echo "🚀 Starting Authentication Service..."
echo ""
echo "Service will run on port: $(grep AUTH_SERVICE_PORT services/auth-service/.env | cut -d '=' -f2 || echo '3001')"
echo ""
echo "Press Ctrl+C to stop the service"
echo ""

cd services/auth-service
npm start
