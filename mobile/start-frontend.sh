#!/bin/bash

# VaultKe Frontend Startup Script
# This script helps you start the VaultKe React Native frontend

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="http://localhost:8080"
FRONTEND_PORT="19006"

# Helper functions
print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

print_step() {
    echo -e "${PURPLE}🔄 $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Node.js is installed: $NODE_VERSION"
    else
        print_error "Node.js is not installed"
        print_info "Please install Node.js from https://nodejs.org/"
        exit 1
    fi
    
    # Check npm
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        print_success "npm is installed: $NPM_VERSION"
    else
        print_error "npm is not installed"
        exit 1
    fi
    
    # Check Expo CLI
    if command -v expo &> /dev/null; then
        EXPO_VERSION=$(expo --version)
        print_success "Expo CLI is installed: $EXPO_VERSION"
    else
        print_warning "Expo CLI is not installed globally"
        print_info "Installing Expo CLI..."
        npm install -g @expo/cli
        print_success "Expo CLI installed successfully"
    fi
}

# Check if backend is running
check_backend() {
    print_header "Checking Backend Status"
    
    if curl -s "$BACKEND_URL/health" > /dev/null; then
        print_success "Backend is running at $BACKEND_URL"
    else
        print_warning "Backend is not running at $BACKEND_URL"
        print_info "You may need to start the backend server:"
        print_info "cd apps/backend && go run main.go"
        echo ""
        read -p "Continue anyway? (y/n): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Install dependencies
install_dependencies() {
    print_header "Installing Dependencies"
    
    if [ -f "package.json" ]; then
        print_step "Installing npm packages..."
        
        if [ -f "package-lock.json" ]; then
            npm ci
        else
            npm install
        fi
        
        print_success "Dependencies installed successfully"
    else
        print_error "package.json not found"
        print_info "Make sure you're in the apps/mobile directory"
        exit 1
    fi
}

# Check for common issues
check_common_issues() {
    print_header "Checking for Common Issues"
    
    # Check node_modules
    if [ -d "node_modules" ]; then
        print_success "node_modules directory exists"
    else
        print_warning "node_modules directory not found"
        print_info "Running npm install..."
        npm install
    fi
    
    # Check for conflicting processes
    if lsof -i :$FRONTEND_PORT &> /dev/null; then
        print_warning "Port $FRONTEND_PORT is already in use"
        print_info "You may need to stop the existing process"
    else
        print_success "Port $FRONTEND_PORT is available"
    fi
    
    # Check Expo configuration
    if [ -f "app.json" ]; then
        print_success "Expo configuration found (app.json)"
    else
        print_error "Expo configuration not found (app.json)"
        exit 1
    fi
}

# Start development server
start_dev_server() {
    print_header "Starting Development Server"
    
    print_info "Starting Expo development server..."
    print_info "This will open Expo DevTools in your browser"
    print_info "Use the QR code to test on your mobile device"
    echo ""
    print_info "Available platforms:"
    print_info "• Web: Press 'w' or visit http://localhost:$FRONTEND_PORT"
    print_info "• iOS: Press 'i' (requires macOS and Xcode)"
    print_info "• Android: Press 'a' (requires Android Studio)"
    print_info "• Mobile: Scan QR code with Expo Go app"
    echo ""
    print_info "Press Ctrl+C to stop the server"
    echo ""
    
    # Start Expo
    npm start
}

# Start with specific platform
start_platform() {
    local platform=$1
    
    print_header "Starting on $platform"
    
    case $platform in
        "web")
            print_info "Starting web development server..."
            npm run web
            ;;
        "ios")
            print_info "Starting iOS simulator..."
            print_warning "This requires macOS and Xcode"
            npm run ios
            ;;
        "android")
            print_info "Starting Android emulator..."
            print_warning "This requires Android Studio setup"
            npm run android
            ;;
        *)
            print_error "Unknown platform: $platform"
            print_info "Available platforms: web, ios, android"
            exit 1
            ;;
    esac
}

# Clear cache and restart
clear_cache() {
    print_header "Clearing Cache"
    
    print_step "Clearing Expo cache..."
    expo start --clear
}

# Reset everything
reset_project() {
    print_header "Resetting Project"
    
    print_step "Removing node_modules..."
    rm -rf node_modules
    
    print_step "Removing package-lock.json..."
    rm -f package-lock.json
    
    print_step "Reinstalling dependencies..."
    npm install
    
    print_step "Clearing Expo cache..."
    expo start --clear
}

# Show project info
show_info() {
    print_header "VaultKe Frontend Information"
    
    echo -e "${CYAN}Project Details:${NC}"
    echo "• Name: VaultKe Mobile App"
    echo "• Framework: React Native with Expo"
    echo "• Platform Support: iOS, Android, Web"
    echo "• Theme: Dark mode by default"
    echo ""
    
    echo -e "${CYAN}Key Features:${NC}"
    echo "• User Authentication"
    echo "• Chama Management"
    echo "• Digital Wallet"
    echo "• Marketplace"
    echo "• Real-time Chat"
    echo "• AI Financial Assistant"
    echo ""
    
    echo -e "${CYAN}Development URLs:${NC}"
    echo "• Web: http://localhost:$FRONTEND_PORT"
    echo "• Backend API: $BACKEND_URL"
    echo "• Backend Health: $BACKEND_URL/health"
    echo ""
    
    if [ -f "package.json" ]; then
        echo -e "${CYAN}Dependencies Status:${NC}"
        if [ -d "node_modules" ]; then
            echo "• Dependencies: ✅ Installed"
        else
            echo "• Dependencies: ❌ Not installed"
        fi
        
        if command -v expo &> /dev/null; then
            echo "• Expo CLI: ✅ Available"
        else
            echo "• Expo CLI: ❌ Not installed"
        fi
    fi
}

# Show usage
show_usage() {
    echo -e "${BLUE}VaultKe Frontend Startup Script${NC}"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  start           Start development server (default)"
    echo "  web             Start on web browser"
    echo "  ios             Start on iOS simulator"
    echo "  android         Start on Android emulator"
    echo "  install         Install dependencies only"
    echo "  check           Check prerequisites and setup"
    echo "  clear-cache     Clear cache and restart"
    echo "  reset           Reset project (reinstall everything)"
    echo "  info            Show project information"
    echo "  help            Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                # Start development server"
    echo "  $0 web           # Start on web browser"
    echo "  $0 check         # Check setup"
    echo "  $0 reset         # Reset everything"
    echo ""
    echo "Quick Start:"
    echo "  1. $0 check      # Verify setup"
    echo "  2. $0 install    # Install dependencies"
    echo "  3. $0 start      # Start development"
}

# Main script logic
main() {
    case "${1:-start}" in
        "start")
            check_prerequisites
            check_backend
            install_dependencies
            check_common_issues
            start_dev_server
            ;;
        "web")
            check_prerequisites
            install_dependencies
            start_platform "web"
            ;;
        "ios")
            check_prerequisites
            install_dependencies
            start_platform "ios"
            ;;
        "android")
            check_prerequisites
            install_dependencies
            start_platform "android"
            ;;
        "install")
            check_prerequisites
            install_dependencies
            print_success "Dependencies installed successfully"
            ;;
        "check")
            check_prerequisites
            check_backend
            check_common_issues
            show_info
            ;;
        "clear-cache")
            clear_cache
            ;;
        "reset")
            reset_project
            ;;
        "info")
            show_info
            ;;
        "help"|*)
            show_usage
            ;;
    esac
}

# Run main function
main "$@"
