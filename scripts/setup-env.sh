#!/bin/bash

# Environment setup script for Noko Reporting Automation
# This script helps you set up the required environment variables

echo "🔧 Noko Reporting Automation - Environment Setup"
echo "============================================="
echo ""

# Check if .env file exists
if [ -f ".env" ]; then
    echo "📄 Found existing .env file. Backing it up to .env.backup"
    cp .env .env.backup
fi

echo "Let's set up your environment variables..."
echo ""

# Noko API Token (required)
echo "🔑 NOKO API TOKEN (Required)"
echo "Get your token from your Noko account settings"
read -p "Enter your Noko API token: " noko_token

if [ -z "$noko_token" ]; then
    echo "❌ Noko API token is required. Exiting."
    exit 1
fi

# Noko User ID (optional)
echo ""
echo "👤 NOKO USER ID (Optional - defaults to 8372)"
echo "Find your user ID by calling: curl -H \"X-NokoToken: YOUR_TOKEN\" https://api.nokotime.com/v2/current_user"
read -p "Enter your Noko user ID (or press Enter for default): " noko_user_id

# Project Configuration
echo ""
echo "📁 PROJECT CONFIGURATION"
echo "You can configure multiple projects for time tracking."
read -p "Enter project names (comma-separated, e.g., 'CATIC,SDSU,MyProject'): " projects_input

if [ -z "$projects_input" ]; then
    projects_input="CATIC,SDSU"
    echo "Using default projects: $projects_input"
fi

# Convert comma-separated list to array
IFS=',' read -ra project_array <<< "$projects_input"
project_ids=""

# Project IDs
echo ""
echo "🔢 PROJECT IDs"
echo "Now we'll get the Noko project IDs for each project."
echo "You can find project IDs in your Noko dashboard or via API."
echo ""

for project in "${project_array[@]}"; do
    project=$(echo "$project" | xargs)  # Trim whitespace
    if [ -n "$project" ]; then
        read -p "Enter project ID for $project: " project_id
        if [ -n "$project_id" ]; then
            project_ids="${project_ids}${project}_PROJECT_ID=$project_id\n"
        fi
    fi
done

# Directory Configuration
echo ""
echo "📂 DIRECTORY CONFIGURATION"
read -p "Enter data directory path (or press Enter for default './data'): " data_dir
if [ -z "$data_dir" ]; then
    data_dir="./data"
fi

# Anthropic API Key (optional)
echo ""
echo "🤖 ANTHROPIC API KEY (Optional - for LLM-powered reports)"
echo "Get your key from: https://console.anthropic.com/"
read -p "Enter your Anthropic API key (or press Enter to skip): " anthropic_key

# Create .env file
echo ""
echo "📝 Creating .env file..."

cat > .env << EOF
# Core Noko Configuration
NOKO_API_TOKEN=$noko_token
EOF

if [ -n "$noko_user_id" ]; then
    echo "NOKO_USER_ID=$noko_user_id" >> .env
fi

# Add project configuration
echo "" >> .env
echo "# Project Configuration" >> .env
echo "PROJECTS=$projects_input" >> .env

if [ -n "$project_ids" ]; then
    echo "" >> .env
    echo -e "$project_ids" >> .env
fi

# Add directory configuration
echo "" >> .env
echo "# Directory Configuration" >> .env
echo "DATA_DIR=$data_dir" >> .env
echo "MEMORY_BANK_ENABLED=true" >> .env

# Add report configuration
echo "" >> .env
echo "# Report Configuration" >> .env
echo "DEFAULT_DAYS_BACK=1" >> .env
echo "CLIPBOARD_ENABLED=true" >> .env

if [ -n "$anthropic_key" ]; then
    echo "" >> .env
    echo "# LLM Configuration (for Claude Code CLI processing)" >> .env
    echo "ANTHROPIC_API_KEY=$anthropic_key" >> .env
fi

echo "✅ Environment file created successfully!"
echo ""

# Test the setup
echo "🧪 Testing the setup..."
echo ""

# Check dependencies
echo "🔍 Checking dependencies..."
missing_deps=""

if ! command -v curl &> /dev/null; then
    missing_deps="$missing_deps curl"
fi

if ! command -v jq &> /dev/null; then
    missing_deps="$missing_deps jq"
fi

if ! command -v node &> /dev/null; then
    missing_deps="$missing_deps node"
fi

# Check clipboard utilities
clipboard_found=false
if command -v pbcopy &> /dev/null || command -v xclip &> /dev/null || command -v xsel &> /dev/null || command -v clip &> /dev/null; then
    clipboard_found=true
fi

if [ -n "$missing_deps" ]; then
    echo "⚠️  Missing required dependencies:$missing_deps"
    echo ""
    echo "📦 Installation instructions:"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "   macOS: brew install$missing_deps"
    elif command -v apt-get &> /dev/null; then
        echo "   Ubuntu/Debian: sudo apt-get install$missing_deps"
    elif command -v yum &> /dev/null; then
        echo "   RHEL/CentOS: sudo yum install$missing_deps"
    fi
    echo ""
else
    echo "✅ All required dependencies found!"
fi

if [ "$clipboard_found" = false ]; then
    echo "⚠️  No clipboard utility found. Install one of:"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "   macOS: pbcopy (usually pre-installed)"
    else
        echo "   Linux: sudo apt-get install xclip   # or xsel"
    fi
    echo "   Or set CLIPBOARD_ENABLED=false in .env to disable clipboard"
    echo ""
fi

# Source the .env file
export $(cat .env | grep -v '^#' | xargs)

# Test Noko API
echo "Testing Noko API connection..."
response=$(curl -s -H "X-NokoToken: $NOKO_API_TOKEN" "https://api.nokotime.com/v2/current_user")

if echo "$response" | grep -q '"id"'; then
    echo "✅ Noko API connection successful!"
    
    # Extract user info
    user_name=$(echo "$response" | jq -r '.first_name + " " + .last_name' 2>/dev/null || echo "Unknown User")
    user_id=$(echo "$response" | jq -r '.id' 2>/dev/null || echo "Unknown ID")
    
    echo "   User: $user_name (ID: $user_id)"
    
    # Update .env with correct user ID if not provided
    if [ -z "$noko_user_id" ] && [ "$user_id" != "Unknown ID" ]; then
        echo "NOKO_USER_ID=$user_id" >> .env
        echo "   ✅ Added your user ID ($user_id) to .env file"
    fi
else
    echo "❌ Noko API connection failed. Please check your token."
fi

# Test Claude Code if API key provided
if [ -n "$anthropic_key" ]; then
    echo ""
    echo "Testing Claude Code CLI..."
    if command -v claude &> /dev/null; then
        echo "✅ Claude Code CLI found!"
    else
        echo "⚠️  Claude Code CLI not found. Install it with:"
        echo "   npm install -g @anthropic-ai/claude-code"
    fi
fi

echo ""
# Create project directories
echo ""
echo "📁 Creating project directories..."
for project in "${project_array[@]}"; do
    project=$(echo "$project" | xargs)  # Trim whitespace
    if [ -n "$project" ]; then
        mkdir -p "$data_dir/$project/logs"
        mkdir -p "$data_dir/$project/memory-bank"
        echo "✅ Created directories for $project"
    fi
done

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
if [ -n "$anthropic_key" ]; then
    echo "1. Test LLM features: npm run llm-geekbot"
    echo "2. Test weekly reports: npm run llm-weekly"
else
    echo "1. Install Claude Code CLI: npm install -g @anthropic-ai/claude-code"
    echo "2. Add ANTHROPIC_API_KEY to .env for LLM features"
fi
echo "3. See README.md for full usage instructions"
echo ""
echo "💡 To use these variables in your current shell, run:"
echo "   source .env" 