#!/bin/bash

# LLM-powered Geekbot update via Claude Code CLI
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

echo "🤖 Starting LLM-Powered Geekbot Update..."

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

# Fetch latest Noko data
echo "📥 Fetching Noko data..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"$SCRIPT_DIR/fetch-noko.sh" both 2 json

# Generate raw data for LLM processing
echo "📝 Generating raw data for LLM..."
RAW_DATA=$(node "$SCRIPT_DIR/generate-reports.js" clean-geekbot 2>/dev/null)

# Check if we have data to process
if [ -z "$RAW_DATA" ] || echo "$RAW_DATA" | grep -q "No entries found"; then
    echo "⚠️  No recent entries found. Generating fallback response..."
    echo "**Section 1 (What's new since your last update?):**
No new LSM project activities in the past day.

**Section 2 (What will you do today?):**
Monitor for new issues on both CATIC and SDSU projects and respond
Be available for client communications and urgent requests
Continue ongoing development and maintenance tasks

**Section 3 (Anything blocking your progress?):**
No current blockers" | pbcopy 2>/dev/null
    echo "✅ Fallback response copied to clipboard!"
    exit 0
fi

# Create system prompt for Claude Code
SYSTEM_PROMPT="When given this log of time tracking entries, organize the entries by project and summarize what has been accomplished. Only pay attention to LSM activities (Internal and Sales activities are already filtered out). Do not summarize the time spent, just focus on a concise list of things accomplished for each project. Remove all hashtags and create clean, professional summaries.

Format the output for Geekbot's 3 questions:

**Section 1 (What's new since your last update?):**
CATIC:
* [clean summary item]
* [clean summary item]

SDSU: 
* [clean summary item]
* [clean summary item]

**Section 2 (What will you do today?):**
Monitor for new issues on both projects and respond
Be available for client communications and urgent requests
Continue ongoing development and maintenance tasks

**Section 3 (Anything blocking your progress?):**
No current blockers"

# Use Claude Code CLI with system prompt
echo "🤖 Processing with Claude Code..."

RESULT=$(echo "$RAW_DATA" | "$CLAUDE_CMD" --system-prompt "$SYSTEM_PROMPT" -p 2>&1)

if [ $? -eq 0 ] && [ -n "$RESULT" ]; then
    echo "$RESULT" | pbcopy 2>/dev/null
    echo "✅ Geekbot update generated and copied to clipboard!"
    echo ""
    echo "📋 Generated response:"
    echo "================================================================="
    echo "$RESULT"
    echo "================================================================="
    echo ""
    echo "🎯 NEXT STEPS:"
    echo "1. The clean, hashtag-free Geekbot update is already in your clipboard"
    echo "2. Open Geekbot and paste the sections when prompted"
    echo "3. Done! No manual processing needed."
else
    echo "⚠️  Claude Code processing failed. Showing raw data for manual processing..."
    echo ""
    echo "📋 Raw data for manual processing:"
    echo "================================================================="
    echo "$RAW_DATA"
    echo "================================================================="
    echo ""
    echo "🎯 MANUAL STEPS:"
    echo "1. Copy the raw data above"
    echo "2. Open Cursor chat (⌘+L) or Claude.ai"
    echo "3. Ask Claude to format it for Geekbot with proper sections"
fi 