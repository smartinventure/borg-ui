#!/bin/bash

# Borgmatic UI Production Build Script
echo "🏗️ Building Borgmatic UI for Production..."

# Build frontend
echo "📦 Building React frontend..."
cd frontend
npm install
npm run build
cd ..

# Set production environment
export NODE_ENV=production

# Start backend server
echo "🚀 Starting production server..."
cd nodejs
npm install
npm start
