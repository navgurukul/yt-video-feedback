#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/home/ubuntu/yt-video-feedback"
BRANCH="master"
PM2_NAME="yt-video-feedback"

exec 200>$APP_DIR/.deploy.lock
flock -n 200 || { echo "Another deployment is running. Exiting."; exit 1; }

cd "$APP_DIR"

echo ">>> $(date) :: Fetching latest $BRANCH..."
git fetch origin $BRANCH
git reset --hard origin/$BRANCH

# If using nvm, load it
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh"
  nvm use default || true
fi

echo ">>> Installing dependencies..."
if [ -f package-lock.json ]; then
  echo "Attempting npm ci..."
  if ! npm ci --no-audit --no-fund; then
    echo "npm ci failed — falling back to npm install..."
    npm install --no-audit --no-fund
  fi
else
  npm install --no-audit --no-fund
fi

echo ">>> Restarting PM2..."
pm2 delete "$PM2_NAME" 2>/dev/null || true
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 reload "$PM2_NAME"
else
  pm2 start npm --name "$PM2_NAME" -- start
fi

pm2 save
echo ">>> Deployment completed successfully at $(date)"
