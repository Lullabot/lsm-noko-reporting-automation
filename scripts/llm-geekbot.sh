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

# Parse command line arguments
EXCLUDE_INTERNAL=false
ARGS_PROCESSED=()

while [[ $# -gt 0 ]]; do
    case $1 in
        --exclude-internal|--lsm-only)
            EXCLUDE_INTERNAL=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --exclude-internal, --lsm-only    Exclude Internal activities from report"
            echo "                                     (useful for part-time CS/LSM users)"
            echo "  --help, -h                         Show this help message"
            echo ""
            echo "Environment Variables:"
            echo "  GEEKBOT_EXCLUDE_INTERNAL=true     Default to excluding Internal activities"
            echo "  NOKO_USER_ID=your_user_id          Your Noko user ID for filtering"
            echo "  NOKO_API_TOKEN=your_token          Your Noko API token"
            exit 0
            ;;
        *)
            ARGS_PROCESSED+=("$1")
            shift
            ;;
    esac
done

# Check environment variable as fallback
if [ "${GEEKBOT_EXCLUDE_INTERNAL:-false}" = "true" ]; then
    EXCLUDE_INTERNAL=true
fi

if [ "$EXCLUDE_INTERNAL" = "true" ]; then
    echo "🎯 LSM-only mode: Internal activities will be excluded from report"
fi

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
echo "📥 Fetching Noko data..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if it's Monday and adjust days back
CURRENT_DAY=$(date +%u)  # 1=Monday, 7=Sunday
if [ "$CURRENT_DAY" -eq 1 ]; then
    echo "🗓️  It's Monday - fetching 4 days back to include Friday's activity"
    DAYS_BACK=4
else
    DAYS_BACK=2
fi

"$SCRIPT_DIR/fetch-noko.sh" both $DAYS_BACK json

# Generate raw data for LLM processing
echo "📝 Generating raw data for LLM..."
if [ "$EXCLUDE_INTERNAL" = "true" ]; then
    RAW_DATA=$(node "$SCRIPT_DIR/generate-reports.js" clean-geekbot $DAYS_BACK exclude-internal 2>/dev/null)
else
    RAW_DATA=$(node "$SCRIPT_DIR/generate-reports.js" clean-geekbot $DAYS_BACK 2>/dev/null)
fi

# Check if we have data to process
if [ -z "$RAW_DATA" ] || echo "$RAW_DATA" | grep -q "No entries found"; then
    echo "⚠️  No recent entries found. Generating fallback response..."
    fallback_response="**Section 1 (What's new since your last update?):**
No new LSM project activities in the past day.

**Section 2 (What will you do today?):**
Monitor for new issues on both projects and respond
Be available for client communications and urgent requests
Continue ongoing development and maintenance tasks

**Section 3 (Anything blocking your progress?):**
No current blockers"
    
    copy_to_clipboard "$fallback_response"
    echo "✅ Fallback response copied to clipboard!"
    exit 0
fi

# Create system prompt for Claude Code based on whether Internal is excluded
if [ "$EXCLUDE_INTERNAL" = "true" ]; then
    SYSTEM_PROMPT="When given this log of time tracking entries, organize the entries by category and summarize what has been accomplished. The entries are categorized into client projects and general LSM work. Internal activities have been excluded from this report. Do not summarize the time spent, just focus on a concise list of things accomplished. Remove all hashtags and create clean, professional summaries.

Categories explained:
- Client Projects (DH, GovHub, MJFF, etc.): LSM client work and support
- LSM: General LSM administrative work, cross-project activities, and LSM infrastructure

Format the output for Geekbot's 3 questions:

**Section 1 (What's new since your last update?):**
[Client Project Name]:
* [clean summary item]
* [clean summary item]

LSM:
* [clean summary of general LSM activities]

**Section 2 (What will you do today?):**
Monitor for new issues on active client projects and respond
Be available for client communications and urgent requests
Continue ongoing LSM administrative and development tasks

**Section 3 (Anything blocking your progress?):**
No current blockers"
else
    SYSTEM_PROMPT="When given this log of time tracking entries, organize the entries by category and summarize what has been accomplished. The entries are already categorized into client projects, general LSM work, and internal activities. Do not summarize the time spent, just focus on a concise list of things accomplished. Remove all hashtags and create clean, professional summaries.

Categories explained:
- Client Projects (DH, GovHub, MJFF, etc.): LSM client work and support
- LSM: General LSM administrative work, cross-project activities, and LSM infrastructure
- Internal: Company-wide activities, internal tools, and administrative work

Format the output for Geekbot's 3 questions:

**Section 1 (What's new since your last update?):**
[Client Project Name]:
* [clean summary item]
* [clean summary item]

LSM:
* [clean summary of general LSM activities]

Internal:
* [clean summary of internal activities]

**Section 2 (What will you do today?):**
Monitor for new issues on active client projects and respond
Be available for client communications and urgent requests
Continue ongoing LSM administrative and development tasks

**Section 3 (Anything blocking your progress?):**
No current blockers"
fi

# Use Claude Code CLI with system prompt
echo "🤖 Processing with Claude Code..."

# Simplify the prompt to avoid issues
SIMPLE_PROMPT="Format the following time tracking entries for a Geekbot update. Remove hashtags, remove all time information (like 15m, 1h 45m, etc.), and organize by project:

$RAW_DATA

Format as:
**Section 1 (What's new since your last update?):**
[List activities by project - exclude all time durations]

**Section 2 (What will you do today?):**
Monitor projects and respond to issues

**Section 3 (Anything blocking your progress?):**
No current blockers"

# Use Claude with simplified prompt (with timeout to prevent hanging)
echo "🔄 Processing data with Claude Code..."

# Try to run Claude with a timeout using a background process
TEMP_OUTPUT="/tmp/claude-output-$$.txt"
(
    "$CLAUDE_CMD" -p "$SIMPLE_PROMPT" > "$TEMP_OUTPUT" 2>&1
) &
CLAUDE_PID=$!

# Wait for up to 10 seconds for Claude
TIMEOUT=10
COUNT=0
while [ $COUNT -lt $TIMEOUT ]; do
    if ! kill -0 $CLAUDE_PID 2>/dev/null; then
        # Process finished
        wait $CLAUDE_PID
        RESULT=$(cat "$TEMP_OUTPUT" 2>/dev/null || echo "")
        rm -f "$TEMP_OUTPUT"
        break
    fi
    sleep 1
    COUNT=$((COUNT + 1))
done

# If still running after timeout, kill it and try Gemini as fallback
if kill -0 $CLAUDE_PID 2>/dev/null; then
    echo "⚠️  Claude CLI appears to be hanging. Trying Gemini as fallback..."
    kill $CLAUDE_PID 2>/dev/null
    rm -f "$TEMP_OUTPUT"
    
    # Check if Gemini is available
    if command -v gemini &> /dev/null; then
        echo "🔄 Processing with Gemini..."
        
        # Create Gemini-specific prompt
        GEMINI_PROMPT="Format the following time tracking entries for a Geekbot update. Remove hashtags and organize by project.

Format the output exactly like this:
**Section 1 (What's new since your last update?):**
[List activities by project name]
- ProjectName: [activities]
- AnotherProject: [activities]

**Section 2 (What will you do today?):**
Monitor for new issues on both projects and respond
Be available for client communications and urgent requests
Continue ongoing development and maintenance tasks

**Section 3 (Anything blocking your progress?):**
No current blockers"
        
        # Use Gemini with piped input
        RESULT=$(echo "$RAW_DATA" | gemini -p "$GEMINI_PROMPT" -y 2>/dev/null || echo "")
    else
        echo "⚠️  Gemini CLI not found. Install with: npm install -g @gemini-ai/cli"
        RESULT=""
    fi
fi

if [ $? -eq 0 ] && [ -n "$RESULT" ]; then
    copy_to_clipboard "$RESULT"
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