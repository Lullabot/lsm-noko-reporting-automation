# 🤖 Hivemind LLM-Powered Reporting Automation

This automation system eliminates the manual copy/paste workflow for Noko time entries and generates professional, hashtag-free reports using Claude Code CLI.

## 🔧 Setup

### 1. Environment Variables
Create a `.env` file in the project root:

```bash
NOKO_API_TOKEN=your_noko_api_token_here
NOKO_USER_ID=your_user_id_here  # Optional - defaults to 8372
CATIC_PROJECT_ID=your_catic_project_id  # Optional - defaults to 701450
SDSU_PROJECT_ID=your_sdsu_project_id    # Optional - defaults to 701708
ANTHROPIC_API_KEY=your_anthropic_api_key_here  # For LLM processing
```

**Getting your API keys:**
- **Noko API token:** Go to [Noko API settings](https://api.nokotime.com/v2/me)
- **Anthropic API key:** Go to [Anthropic Console](https://console.anthropic.com/)

### 2. Install Claude Code CLI
```bash
# Install Claude Code CLI globally
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version
```

### 3. Quick Setup (Recommended)
```bash
# Interactive setup script - walks you through everything
npm run setup
```

### 4. Test the Setup
```bash
# Test LLM-powered Geekbot update
npm run llm-geekbot

# Test LLM-powered weekly reports
npm run llm-weekly
```

## 🚀 Quick Start

### Daily Geekbot Updates
```bash
npm run llm-geekbot
```
**What it does:** 
1. Fetches your personal Noko data from yesterday and today
2. Processes it with Claude Code CLI to remove hashtags and create professional summaries
3. Formats it for Geekbot's 3-section structure
4. Copies clean result to clipboard - ready to paste!

### Weekly Reports  
```bash
npm run llm-weekly
```
**What it does:** 
1. Fetches weekly team Noko data
2. Processes it with Claude Code CLI for professional formatting
3. Generates both LSM Office Hour and Weekly Update formats
4. Copies results to clipboard - ready to paste!

### VS Code Integration
1. Open Command Palette (`Cmd+Shift+P`)
2. Type "Tasks: Run Task"
3. Choose from:
   - `🤖 LLM-Powered Geekbot (via Claude Code)` ⭐ **Daily Updates**
   - `🏢 LLM-Powered LSM Reports (via Claude Code)` ⭐ **Weekly Reports**
   - `📥 Fetch Noko Data` (Manual data fetch if needed)
   - `🔧 Setup Environment Variables` (Initial setup)

## 📋 Report Types Generated

### Daily Geekbot Updates
Professional 3-section format ready for Geekbot:
1. **What's new since your last update?** - Your personal LSM activities (hashtags removed)
2. **What will you do today?** - Standard forward-looking tasks
3. **Anything blocking your progress?** - "No current blockers" (or actual blockers if any)

### Weekly Reports  
- **LSM Office Hour Format**: Project status with color indicators
- **LSM Weekly Update Format**: Comprehensive weekly summary

## 🎯 Your New Workflow

### Daily (Geekbot)
1. Run: `npm run llm-geekbot`
2. Clean, professional update is automatically copied to clipboard
3. Paste sections into Geekbot when prompted
4. Done! No manual processing needed.

### Weekly (Wednesday - LSM Office Hour)
1. Run: `npm run llm-weekly`
2. Both report formats are automatically copied to clipboard
3. Use the appropriate format for each channel
4. Done! No manual processing needed.

## 🔧 Advanced Usage

### Manual Data Fetching
```bash
# Fetch both projects, last 7 days
npm run fetch

# Fetch just today's data
npm run fetch-daily
```

### File Locations
**Noko Data Saved To:**
- `agents/CATIC/pm/logs/noko-YYYY-MM-DD.json`
- `agents/SDSU/pm/logs/noko-YYYY-MM-DD.json`

**Reports Use:**
- Latest Noko JSON files
- Project memory bank files (`agents/*/memory-bank/`) for context

## ⚙️ Technical Details

### What's Fully Automated
- ✅ Noko API data fetching (no more manual copy/paste)
- ✅ LSM activity filtering (ignores Internal/Sales entries)
- ✅ Professional text processing via Claude Code CLI
- ✅ Hashtag removal and text cleanup
- ✅ Report formatting for all channels
- ✅ Clipboard integration (ready to paste)
- ✅ VS Code integration (Command Palette access)

### Key Features
- **Smart Date Filtering**: Includes entries from yesterday and today for daily updates
- **User-Specific Filtering**: Only your entries (User ID 8372) for Geekbot updates
- **Professional Summarization**: Claude Code CLI removes hashtags and creates readable summaries
- **Multiple Format Support**: Generates different formats for different reporting needs
- **Cross-Platform**: Works on macOS and Linux

### Dependencies
- `curl` (for Noko API calls)
- `jq` (for JSON processing)
- `node` (for data processing)
- `pbcopy` (for clipboard integration - macOS)
- `@anthropic-ai/claude-code` (for LLM processing)

## 🚨 Troubleshooting

### Common Issues
- **"NOKO_API_TOKEN not set"**: Run `npm run setup` to configure environment variables
- **"claude command not found"**: Install Claude Code CLI with `npm install -g @anthropic-ai/claude-code`
- **"No entries found"**: Check that you have recent Noko entries and the API token is valid
- **"Invalid API key"**: Verify your `ANTHROPIC_API_KEY` in the `.env` file

### Getting Help
1. Check that all environment variables are set correctly
2. Verify API keys are valid and have proper permissions
3. Test with `npm run setup` to validate configuration 