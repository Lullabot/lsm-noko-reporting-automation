#!/bin/bash

# Environment setup script for Hivemind Reporting Automation
# This script helps you set up the required environment variables

echo "🔧 Hivemind Reporting Automation - Environment Setup"
echo "=================================================="
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
echo "Get your token from: https://api.nokotime.com/v2/me"
read -p "Enter your Noko API token: " noko_token

if [ -z "$noko_token" ]; then
    echo "❌ Noko API token is required. Exiting."
    exit 1
fi

# Noko User ID (optional)
echo ""
echo "👤 NOKO USER ID (Optional - defaults to 8372)"
echo "Find your user ID by calling: curl -H \"X-NokoToken: YOUR_TOKEN\" https://api.nokotime.com/v2/me"
read -p "Enter your Noko user ID (or press Enter for default): " noko_user_id

# Project IDs (optional)
echo ""
echo "📁 PROJECT IDs (Optional - defaults provided)"
read -p "Enter CATIC project ID (or press Enter for default 701450): " catic_project_id
read -p "Enter SDSU project ID (or press Enter for default 701708): " sdsu_project_id

# Anthropic API Key (optional)
echo ""
echo "🤖 ANTHROPIC API KEY (Optional - for LLM-powered reports)"
echo "Get your key from: https://console.anthropic.com/"
read -p "Enter your Anthropic API key (or press Enter to skip): " anthropic_key

# Create .env file
echo ""
echo "📝 Creating .env file..."

cat > .env << EOF
# Noko Time Tracking API Configuration
NOKO_API_TOKEN=$noko_token
EOF

if [ -n "$noko_user_id" ]; then
    echo "NOKO_USER_ID=$noko_user_id" >> .env
fi

if [ -n "$catic_project_id" ]; then
    echo "CATIC_PROJECT_ID=$catic_project_id" >> .env
fi

if [ -n "$sdsu_project_id" ]; then
    echo "SDSU_PROJECT_ID=$sdsu_project_id" >> .env
fi

if [ -n "$anthropic_key" ]; then
    echo "" >> .env
    echo "# Claude Code API Configuration (for LLM-powered reports)" >> .env
    echo "ANTHROPIC_API_KEY=$anthropic_key" >> .env
fi

echo "✅ Environment file created successfully!"
echo ""

# Test the setup
echo "🧪 Testing the setup..."
echo ""

# Source the .env file
export $(cat .env | grep -v '^#' | xargs)

# Test Noko API
echo "Testing Noko API connection..."
response=$(curl -s -H "X-NokoToken: $NOKO_API_TOKEN" "https://api.nokotime.com/v2/me")

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
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Test the automation: npm run daily"
if [ -n "$anthropic_key" ]; then
    echo "2. Test LLM features: npm run llm-geekbot"
fi
echo "3. See README-automation.md for full usage instructions"
echo ""
echo "💡 To use these variables in your current shell, run:"
echo "   source .env" 