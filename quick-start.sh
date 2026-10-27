#!/usr/bin/env bash

# Quick Start - Run Your First Demo!
# Choose which demo to try. All demos use Ink through the shared ui/ package.

cd "$(dirname "$0")" || exit 1

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
echo "     - Real-time data from this machine"
echo ""
echo "  4) 🎨 Animation Demo (ASCII Art)"
echo "     - 7 terminal animations"
echo "     - Runs directly (no SSH)"
echo ""
echo "  5) 🧪 Run Tests (ui package and Demo Shop)"
echo ""
echo "  6) 🆕 Create New App (Use the template)"
echo ""
echo "  0) Exit"
echo ""

read -r -p "Enter choice [0-6]: " choice

# Install dependencies and a host key for an SSH demo, then start it.
start_ssh_demo() {
  local dir="$1"
  local name="$2"
  echo ""
  echo "Starting $name..."
  cd "$dir" || exit 1
  if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    ./npmw install || exit 1
  fi
  if [ ! -f "keys/host_key" ]; then
    echo "🔐 Generating SSH keys..."
    ./npmw run generate-keys || exit 1
  fi
  echo ""
  echo "✅ Ready! Starting server..."
  echo "🌐 Connect with: ssh localhost -p 2222"
  echo "⚠️  Press Ctrl+C to stop server"
  echo ""
  ./npmw start
}

case $choice in
  1)
    start_ssh_demo demo-shop "🛒 Demo Shop"
    ;;

  2)
    start_ssh_demo adventure-game "⚔️  Adventure Game"
    ;;

  3)
    start_ssh_demo admin-dashboard "🖥️  Admin Dashboard"
    ;;

  4)
    echo ""
    echo "🎨 Starting Animation Demo..."
    cd animation-demo || exit 1
    if [ ! -d "node_modules" ]; then
      echo "📦 Installing dependencies..."
      ./npmw install || exit 1
    fi
    echo ""
    echo "✅ Ready! Starting animations..."
    echo "⚠️  Press q or Ctrl+C to stop"
    echo ""
    ./npmw start
    ;;

  5)
    echo ""
    echo "🧪 Running Tests..."
    echo ""
    for dir in ui demo-shop; do
      if [ ! -d "$dir/node_modules" ]; then
        echo "📦 Installing dependencies in $dir..."
        (cd "$dir" && npm ci) || exit 1
      fi
    done
    echo ""
    echo "Running ui tests..."
    (cd ui && npm test) || { echo "❌ ui tests failed"; exit 1; }
    echo ""
    echo "Running Demo Shop unit tests..."
    (cd demo-shop && ./npmw run test:unit) || { echo "❌ Demo Shop tests failed"; exit 1; }
    echo ""
    echo "✅ All tests passed!"
    echo ""
    ;;

  6)
    echo ""
    read -r -p "Enter your app name: " appname
    if [ -z "$appname" ]; then
      appname="my-terminal-app"
    fi
    read -r -p "App type, minimal or ecommerce [minimal]: " apptype
    if [ -z "$apptype" ]; then
      apptype="minimal"
    fi
    echo ""
    echo "🆕 Creating new app: $appname"
    ./init.sh "$appname" "$apptype"
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
