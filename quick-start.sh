#!/bin/bash

# Quick Start - Run Your First Demo!
# Choose which demo to try:

echo ""
echo "🎉 Terminal App Template - Quick Demo Launcher"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Choose a demo to run:"
echo ""
echo "  1) 🛒 Demo Shop (E-commerce)"
echo "     - Product catalog"
echo "     - Shopping cart"
echo "     - Checkout form"
echo ""
echo "  2) ⚔️  Adventure Game (Text-based RPG)"
echo "     - Explore 6 rooms"
echo "     - Collect items"
echo "     - Find the treasure!"
echo ""
echo "  3) 🖥️  Admin Dashboard (System Monitor)"
echo "     - CPU & Memory stats"
echo "     - Process monitor"
echo "     - Real-time data from YOUR Mac"
echo ""
echo "  4) 🎨 Animation Demo (ASCII Art)"
echo "     - 7 terminal animations"
echo "     - Runs directly (no SSH)"
echo ""
echo "  5) 🧪 Run Tests (Verify everything works)"
echo ""
echo "  6) 🆕 Create New App (Use the template)"
echo ""
echo "  0) Exit"
echo ""

read -p "Enter choice [0-6]: " choice

case $choice in
  1)
    echo ""
    echo "🛒 Starting Demo Shop..."
    cd demo-shop || exit
    if [ ! -d "node_modules" ]; then
      echo "📦 Installing dependencies..."
      npm install
    fi
    if [ ! -f "keys/host_key" ]; then
      echo "🔐 Generating SSH keys..."
      npm run generate-keys
    fi
    echo ""
    echo "✅ Ready! Starting server..."
    echo "🌐 Connect with: ssh localhost -p 2222"
    echo "⚠️  Press Ctrl+C to stop server"
    echo ""
    npm start
    ;;
  
  2)
    echo ""
    echo "⚔️  Starting Adventure Game..."
    cd adventure-game || exit
    if [ ! -d "node_modules" ]; then
      echo "📦 Installing dependencies..."
      npm install
    fi
    if [ ! -f "keys/host_key" ]; then
      echo "🔐 Generating SSH keys..."
      npm run generate-keys
    fi
    echo ""
    echo "✅ Ready! Starting server..."
    echo "🌐 Connect with: ssh localhost -p 2222"
    echo "⚠️  Press Ctrl+C to stop server"
    echo ""
    npm start
    ;;
  
  3)
    echo ""
    echo "🖥️  Starting Admin Dashboard..."
    cd admin-dashboard || exit
    if [ ! -d "node_modules" ]; then
      echo "📦 Installing dependencies..."
      npm install
    fi
    if [ ! -f "keys/host_key" ]; then
      echo "🔐 Generating SSH keys..."
      npm run generate-keys
    fi
    echo ""
    echo "✅ Ready! Starting server..."
    echo "🌐 Connect with: ssh localhost -p 2222"
    echo "⚠️  Press Ctrl+C to stop server"
    echo ""
    npm start
    ;;
  
  4)
    echo ""
    echo "🎨 Starting Animation Demo..."
    cd animation-demo || exit
    if [ ! -d "node_modules" ]; then
      echo "📦 Installing dependencies..."
      npm install
    fi
    echo ""
    echo "✅ Ready! Starting animations..."
    echo "⚠️  Press q or Ctrl+C to stop"
    echo ""
    npm start
    ;;

  5)
    echo ""
    echo "🧪 Running Tests..."
    echo ""
    cd demo-shop || exit
    if [ ! -d "node_modules" ]; then
      echo "📦 Installing dependencies..."
      npm install
    fi
    if [ ! -f "keys/host_key" ]; then
      echo "🔐 Generating SSH keys..."
      npm run generate-keys
    fi
    echo ""
    echo "Running unit tests..."
    npm run test:unit
    echo ""
    echo "✅ All tests passed!"
    echo ""
    ;;
  
  6)
    echo ""
    read -p "Enter your app name: " appname
    if [ -z "$appname" ]; then
      appname="my-terminal-app"
    fi
    echo ""
    echo "🆕 Creating new app: $appname"
    ./init.sh "$appname"
    echo ""
    echo "✅ App created! Next steps:"
    echo "   cd $appname"
    echo "   npm install"
    echo "   npm run generate-keys"
    echo "   npm test"
    echo "   npm start"
    echo ""
    ;;
  
  0)
    echo ""
    echo "👋 Goodbye!"
    echo ""
    exit 0
    ;;
  
  *)
    echo ""
    echo "❌ Invalid choice. Please run again and choose 0-6."
    echo ""
    exit 1
    ;;
esac
