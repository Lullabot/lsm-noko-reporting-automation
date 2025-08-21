# 🤖 Noko Reporting Automation

Automated reporting tools for Noko time tracking with LLM-powered processing. This system eliminates manual copy/paste workflows and generates professional, hashtag-free reports using Claude Code CLI.

## ✨ Features

- **🔄 Automated Data Fetching**: Direct integration with Noko API
- **🤖 LLM-Powered Processing**: Clean, professional report generation via Claude Code CLI
- **🔁 Automatic Fallback**: Seamless Gemini CLI fallback when Claude encounters issues
- **📋 Multiple Project Support**: Configure any number of projects dynamically
- **🌍 Cross-Platform**: Works on macOS, Linux, and Windows
- **📱 Smart Clipboard**: Automatic clipboard integration (configurable)
- **🎯 Multiple Report Formats**: Daily updates and weekly summaries
- **⚙️ Flexible Configuration**: Environment-based setup for any team

## 🚀 Quick Start

### 1. Install Dependencies

**Required:**
- Node.js (v14+)
- curl
- jq

**Installation:**
```bash
# macOS
brew install curl jq node

# Ubuntu/Debian  
sudo apt-get install curl jq nodejs

# Windows (via WSL or native)
# Install Node.js from nodejs.org
# Install WSL and follow Linux instructions
```

### 2. Install LLM CLI Tools

```bash
# Install Claude Code CLI (primary)
npm install -g @anthropic-ai/claude-code

# Install Gemini CLI (fallback)
npm install -g @google/gemini-cli

# Verify installations
claude --version
gemini --version
```

**Note:** Claude Code CLI is the primary tool for LLM-powered report generation. Gemini CLI serves as an automatic fallback if Claude encounters issues.

### 3. Interactive Setup

```bash
# Clone the repository
git clone https://github.com/Lullabot/lsm-noko-reporting-automation.git
cd lsm-noko-reporting-automation

# Run interactive setup
npm run setup
```

The setup script will guide you through:
- Noko API token configuration
- Project names and IDs
- Directory structure creation
- Dependency checking
- API validation

### 4. Test Your Setup

```bash
# Test daily reports
npm run llm-geekbot

# Test weekly reports  
npm run llm-weekly
```

## 📋 Usage

### Daily Updates

Generate clean daily reports for standup/status meetings:

```bash
npm run llm-geekbot
```

**Output format:**
```
**Section 1 (What's new since your last update?):**
ProjectName:
* Clean summary of accomplishments (hashtags removed)

**Section 2 (What will you do today?):**
Monitor for new issues and respond
Be available for client communications

**Section 3 (Anything blocking your progress?):**
No current blockers
```

### Weekly Reports

Generate comprehensive weekly summaries:

```bash
npm run llm-weekly
```

**Output includes:**
- Office hour status updates with color indicators
- Detailed weekly project summaries
- Accomplishments and next steps

### Manual Data Operations

```bash
# Fetch data for all projects (7 days)
npm run fetch

# Fetch daily data only
npm run fetch-daily

# Generate raw data for custom processing
node scripts/generate-reports.js raw-weekly
node scripts/generate-reports.js clean-geekbot
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file (or use `npm run setup`):

```bash
# Core Noko Configuration
NOKO_API_TOKEN=your_noko_api_token_here
NOKO_USER_ID=your_user_id_here

# Project Configuration
PROJECTS=ProjectA,ProjectB,ProjectC
PROJECTA_PROJECT_ID=123456
PROJECTB_PROJECT_ID=789012
PROJECTC_PROJECT_ID=345678

# LLM Configuration  
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Directory Configuration
DATA_DIR=./data
MEMORY_BANK_ENABLED=true

# Report Configuration
DEFAULT_DAYS_BACK=1
CLIPBOARD_ENABLED=true
```

### Project Directory Structure

Data is organized as:
```
data/
├── ProjectA/
│   ├── logs/           # Noko JSON files
│   └── memory-bank/    # Project context (optional)
├── ProjectB/
│   ├── logs/
│   └── memory-bank/
└── ProjectC/
    ├── logs/
    └── memory-bank/
```

### API Keys

**Noko API Token:**
1. Visit your Noko account settings to generate an API token
2. Test your token: `curl -H "X-NokoToken: YOUR_TOKEN" https://api.nokotime.com/v2/current_user`
3. Find your user ID in the JSON response (look for the "id" field)

**Anthropic API Key:**
1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Create an API key
3. Ensure you have Claude access

**Noko Project IDs:**
- Found in your Noko dashboard URL
- Or use the API: `curl -H "X-NokoToken: TOKEN" https://api.nokotime.com/v2/projects`

## 🔧 Advanced Configuration

### Cross-Platform Clipboard

The system automatically detects available clipboard utilities:
- **macOS**: `pbcopy` (built-in)
- **Linux**: `xclip` or `xsel` 
- **Windows**: `clip` (via WSL or PowerShell)

Disable clipboard: `CLIPBOARD_ENABLED=false`

### Custom Data Directory

Change where data is stored:
```bash
DATA_DIR=/path/to/your/data
```

### Memory Bank Integration

Enable project context for enhanced reporting:
```bash
MEMORY_BANK_ENABLED=true
```

Add context files to `data/ProjectName/memory-bank/`:
- `activeContext.md` - Current focus
- `progress.md` - Status and next steps
- `productContext.md` - Project background

### LSM Activity Classification

**LSM** = **Lullabot Support and Maintenance Department**

The system automatically identifies LSM activities using dynamic project discovery and intelligent filtering. For comprehensive details on LSM classification logic, edge cases, and troubleshooting, see:

📋 **[LSM Activity Classification Guide](LSM.md)**

**Quick Summary:**
- **Primary identification**: Noko projects with `[LSM]` prefix
- **Dynamic discovery**: Projects auto-discovered from `data/` directory  
- **Flexible filtering**: Handles edge cases and context-dependent classification
- **User-specific reports**: Configure with `NOKO_USER_ID` environment variable

## 🛠️ Development

### Project Structure

```
lsm-noko-reporting-automation/
├── scripts/
│   ├── fetch-noko.sh       # Noko API data fetching
│   ├── generate-reports.js # Report data processing
│   ├── llm-geekbot.sh     # Daily update automation
│   ├── llm-weekly.sh      # Weekly report automation
│   └── setup-env.sh       # Interactive setup
├── package.json           # NPM scripts and metadata
├── .env.example          # Configuration template
└── README.md             # Documentation
```

### NPM Scripts

```bash
npm run setup          # Interactive environment setup
npm run llm-geekbot    # Generate daily reports
npm run llm-weekly     # Generate weekly reports  
npm run fetch          # Fetch 7 days of data
npm run fetch-daily    # Fetch 1 day of data
```

### Script API

```bash
# Direct script usage
./scripts/fetch-noko.sh ProjectName 7 json
node scripts/generate-reports.js raw-weekly
./scripts/llm-geekbot.sh
```

## 🚨 Troubleshooting

### Common Issues

**"NOKO_API_TOKEN not set"**
- Run `npm run setup` to configure environment
- Ensure `.env` file exists with valid token

**"claude command not found"**
- Install: `npm install -g @anthropic-ai/claude-code`
- Verify: `claude --version`

**Claude CLI hanging with -p flag**
- This is a known issue with Claude CLI v1.0.86
- The script automatically falls back to Gemini CLI after 10 seconds
- Install Gemini for seamless fallback: `npm install -g @gemini-ai/cli`

**"No entries found"**
- Check Noko API token validity
- Verify project IDs are correct
- Ensure you have time entries in the specified date range

**API returns 404 or no response**
- Ensure you're using the correct endpoint: `/v2/current_user` (not `/v2/me`)
- Test with verbose output: `curl -v -H "X-NokoToken: YOUR_TOKEN" https://api.nokotime.com/v2/current_user`
- Verify your API token has proper permissions

**"Project ID not found"**
- Add `PROJECTNAME_PROJECT_ID=123456` to `.env`
- Find project IDs in Noko dashboard or via API

**Clipboard not working**
- Install clipboard utility for your platform
- Or set `CLIPBOARD_ENABLED=false`

### Dependency Issues

**Missing `jq`:**
```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq

# CentOS/RHEL
sudo yum install jq
```

**Missing `curl`:**
- Usually pre-installed on Unix systems
- Windows: Available in PowerShell or WSL

### Validation

Test your configuration:
```bash
# Validate environment
npm run setup

# Test API connectivity
curl -H "X-NokoToken: $NOKO_API_TOKEN" https://api.nokotime.com/v2/current_user

# Test Claude Code CLI
claude --version
```

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

For issues or feature requests, please use GitHub Issues.