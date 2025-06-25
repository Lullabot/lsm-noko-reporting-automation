#!/bin/bash

# LLM-powered weekly reports via Claude Code CLI
# This script generates raw Noko data and processes it directly with Claude

set -e

# Load environment variables from .env file if it exists
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check for required environment variables
if [ -z "$NOKO_API_TOKEN" ]; then
    echo "❌ Error: NOKO_API_TOKEN environment variable is not set"
    echo "   Please set your Noko API token:"
    echo "   export NOKO_API_TOKEN=your_token_here"
    echo ""
    echo "   Or create a .env file with:"
    echo "   NOKO_API_TOKEN=your_token_here"
    exit 1
fi

echo "🏢 Starting LLM-Powered Weekly Reports..."

# Find claude executable (handles aliases and different install locations)
CLAUDE_CMD=""
if command -v claude &> /dev/null; then
    CLAUDE_CMD="claude"
elif [ -f "/Users/sirkitree/.claude/local/claude" ]; then
    CLAUDE_CMD="/Users/sirkitree/.claude/local/claude"
elif [ -f "$HOME/.claude/local/claude" ]; then
    CLAUDE_CMD="$HOME/.claude/local/claude"
else
    echo "❌ Claude Code CLI not found. Please install it first:"
    echo "   npm install -g @anthropic-ai/claude-code"
    echo ""
    echo "   Or follow installation instructions at:"
    echo "   https://docs.anthropic.com/en/docs/claude-code/overview"
    exit 1
fi

echo "🔍 Using Claude at: $CLAUDE_CMD"

# Cross-platform clipboard function
copy_to_clipboard() {
    local content="$1"
    if [ "${CLIPBOARD_ENABLED:-true}" = "false" ]; then
        echo "📋 Clipboard disabled via CLIPBOARD_ENABLED=false"
        return 0
    fi
    
    if command -v pbcopy &> /dev/null; then
        # macOS
        echo "$content" | pbcopy
    elif command -v xclip &> /dev/null; then
        # Linux with xclip
        echo "$content" | xclip -selection clipboard
    elif command -v xsel &> /dev/null; then
        # Linux with xsel
        echo "$content" | xsel --clipboard --input
    elif command -v clip &> /dev/null; then
        # Windows/WSL
        echo "$content" | clip
    else
        echo "⚠️  No clipboard utility found. Install pbcopy (macOS), xclip/xsel (Linux), or clip (Windows)"
        return 1
    fi
}

# Fetch latest Noko data
echo "📥 Fetching weekly Noko data..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/fetch-noko.sh" both 7 json

# Generate raw data for LLM processing
echo "📝 Generating raw data for LLM..."
RAW_DATA=$(node "$SCRIPT_DIR/generate-reports.js" clean-weekly 2>/dev/null)

# Check if we have data to process
if [ -z "$RAW_DATA" ] || echo "$RAW_DATA" | grep -q "No entries found"; then
    echo "⚠️  No entries found this week. Generating fallback response..."
    fallback_response="**REPORT 1: LSM Office Hour Update**
No updates this week for configured projects.

**REPORT 2: LSM Weekly Update**
## Project Updates
**This Week:**
- No significant activity

**Next Week:**
- Monitor for new issues and client requests
- Continue maintenance activities

**Status:** On track"
    
    copy_to_clipboard "$fallback_response"
    echo "✅ Fallback response copied to clipboard!"
    exit 0
fi

# Create system prompt for Claude Code
SYSTEM_PROMPT="Please process this time tracking data and create two clean reports by removing hashtags and summarizing activities:

**REPORT 1: LSM Office Hour Update**
CATIC :large_green_circle:
- [clean summary without hashtags]

SDSU :large_green_circle:
- [clean summary without hashtags]

**REPORT 2: LSM Weekly Update**
## CATIC Project Update
**This Week:** [summary of accomplishments]
**Status:** On track

## SDSU Project Update  
**This Week:** [summary of accomplishments]
**Status:** On track"

# Use Claude Code CLI with system prompt
echo "🤖 Processing with Claude Code..."

# Capture both stdout and stderr for better error handling
RESULT=$(echo "$RAW_DATA" | "$CLAUDE_CMD" --system-prompt "$SYSTEM_PROMPT" -p 2>&1)

# Check if result looks like an error (but not if it contains "REPORT")
if echo "$RESULT" | grep -qi "execution error\|failed\|invalid\|exception" && ! echo "$RESULT" | grep -qi "REPORT"; then
    echo "⚠️  Claude Code returned an error: $RESULT"
    echo ""
    echo "📋 Raw data for manual processing:"
    echo "================================================================="
    echo "$RAW_DATA"
    echo "================================================================="
    echo ""
    echo "🎯 MANUAL STEPS:"
    echo "1. Copy the raw data above"
    echo "2. Open Cursor chat (⌘+L) or Claude.ai"
    echo "3. Ask Claude to format it for both weekly report formats"
elif [ -n "$RESULT" ]; then
    copy_to_clipboard "$RESULT"
    echo "✅ Weekly reports generated and copied to clipboard!"
    echo ""
    echo "📋 Generated reports:"
    echo "================================================================="
    echo "$RESULT"
    echo "================================================================="
    echo ""
    echo "🎯 NEXT STEPS:"
    echo "1. Both clean, hashtag-free reports are already in your clipboard"
    echo "2. Copy Report 1 for LSM Office Hour (Wednesday)"
    echo "3. Copy Report 2 for LSM Weekly Update (Friday)"
    echo "4. Done! No manual processing needed."
else
    echo "⚠️  Claude Code returned empty response"
    echo ""
    echo "📋 Raw data for manual processing:"
    echo "================================================================="
    echo "$RAW_DATA"
    echo "================================================================="
    echo ""
    echo "🎯 MANUAL STEPS:"
    echo "1. Copy the raw data above"
    echo "2. Open Cursor chat (⌘+L) or Claude.ai"
    echo "3. Ask Claude to format it for both weekly report formats"
fi 