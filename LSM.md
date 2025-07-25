# LSM Activity Classification Guide

**LSM** = **Lullabot Support and Maintenance Department**

This guide explains how the Noko reporting automation system identifies and classifies LSM activities, handles edge cases, and adapts to different project setups.

## 🎯 Classification Overview

The system uses a **tiered approach** to identify LSM activities with built-in flexibility for edge cases:

### Primary Identification: Noko Project Names
- Projects with **`[LSM]`** prefix are automatically classified as LSM activities
- Examples:
  - `[LSM] Georgia Support SON 2025 RETAINER (04404)`
  - `[LSM] MJFF SOW 6 ENHANCED STABILITY RETAINER 04367`
  - `[LSM] Client Name PROJECT DESCRIPTION`

### Secondary Filtering: Tag-Based Exclusions  
- Entries tagged with `#internal` or `#sales` are excluded from LSM reports
- This handles edge cases where LSM work might be logged to other Noko buckets
- Conservative approach: if no exclusion tags, entry is considered potentially LSM

### Dynamic Project Discovery
- Projects are automatically discovered from your `data/` directory structure
- No need to hardcode project lists - system adapts to your actual project setup
- Override with `PROJECTS=Project1,Project2` environment variable if needed

## 🔍 LSM Work Examples

### Typical LSM Activities
- **Client support and maintenance**: Bug fixes, security updates, performance optimization
- **Dependency updates**: Composer updates, security patches, version upgrades  
- **Code reviews and QA**: Reviewing client work, testing deployments, quality assurance
- **Project management**: Sprint planning, client communication, issue triage for LSM projects
- **Development work**: Feature development on LSM-managed client projects
- **Infrastructure tasks**: Server maintenance, deployment automation, monitoring

### Meeting and Communication
- **Client standups/syncs**: Regular check-ins with LSM clients
- **LSM team meetings**: Internal coordination, planning, knowledge sharing
- **Professional development**: When directly related to LSM client needs

## ⚙️ Edge Cases and Context

### 1. Work Logged to Non-LSM Noko Buckets

Sometimes LSM work is logged to other project buckets for business/accounting reasons:

#### **Drainpipe Work** (Project ID: 687916)
- LSM team maintaining Drainpipe tool used by multiple clients
- Logged to Drainpipe bucket but often LSM work when done by LSM team members
- **Context matters**: Same work might be Internal vs LSM depending on who does it

#### **Lullabotdotcom Work** (Project ID: 550434)  
- LSM team work on company website infrastructure
- May be logged to company bucket but could be LSM work
- **Classification depends**: on whether it's LSM-requested vs general company work

### 2. Context-Dependent Classification

The **same activity** may be classified differently based on context:

| Activity | LSM Context | Internal Context |
|----------|-------------|------------------|
| Dependency update | Client requests security patch | General maintenance of internal tools |
| Code review | Reviewing LSM client work | Reviewing internal project work |
| Meeting attendance | LSM client standup | Company all-hands meeting |
| Tool development | Building client-specific tooling | General process improvement |

### 3. LSM vs Internal - Decision Framework

**Classify as LSM when:**
- Work is requested by LSM PM or manager
- Work directly benefits LSM clients
- Work is billable to LSM client contracts
- Work maintains LSM-managed client projects

**Classify as Internal when:**
- Work benefits general company operations
- Work tagged with `#internal` or `#sales`
- Work is general professional development unrelated to clients
- Work is exploratory/research for potential future use

## 🔧 Configuration and Customization

### Environment Variables

```bash
# User filtering (reports only show your entries)
NOKO_USER_ID=your_user_id_here

# Custom project discovery (optional)
PROJECTS=ProjectA,ProjectB,ProjectC

# Data directory (defaults to ./data)
DATA_DIR=./data
```

### Finding Your User ID

Check what user IDs exist in your data:
```bash
grep -o '"user":{"id":[0-9]*' data/*/logs/*.json | sort | uniq
```

### Testing LSM Classification

```bash
# Test with realistic data (adjust user ID and days as needed)
NOKO_USER_ID=72862 node scripts/generate-reports.js raw-geekbot 4

# Check project discovery
node scripts/generate-reports.js raw-geekbot 1
```

## 🎯 Report Generation

### Geekbot Daily Reports
- **Scope**: Personal LSM activities for daily standup
- **Filtering**: User-specific + LSM classification + date range
- **Format**: Clean, hashtag-free summaries organized by project

### Weekly Reports  
- **Scope**: Team LSM activities for comprehensive review
- **Filtering**: All LSM team members + LSM classification + 7-day range
- **Format**: Office hours status + detailed project summaries

## 🔍 Troubleshooting

### "No entries found" Despite Valid Data
1. **Check user ID**: Verify `NOKO_USER_ID` matches actual data
2. **Check date range**: Ensure entries exist within specified time range  
3. **Check LSM classification**: Verify projects have `[LSM]` prefix or lack exclusion tags

### Projects Not Discovered
1. **Check data directory**: Ensure projects have `data/ProjectName/logs/` structure
2. **Check file naming**: Ensure Noko files follow `noko-YYYY-MM-DD.json` pattern
3. **Override if needed**: Set `PROJECTS=Project1,Project2` environment variable

### Unexpected Entries Included/Excluded
1. **Review project names**: Check for `[LSM]` prefix in Noko project names
2. **Check tags**: Look for `#internal` or `#sales` exclusion tags
3. **Verify context**: Consider if classification matches actual work context

## 🚀 Future Enhancements

### Potential Improvements
- **Smart context detection**: Use AI to classify borderline cases
- **Team-based filtering**: Different rules for different LSM team members
- **Project-specific rules**: Custom classification rules per project
- **Integration with time tracking**: Direct Noko API integration for real-time classification

### Contributing Classification Rules
If you encounter edge cases or have suggestions for improving LSM classification:
1. Document the specific case and context
2. Propose classification rule or logic
3. Test with sample data if possible
4. Submit as issue or pull request with examples

---

## Related Documentation
- [README.md](README.md) - Main project documentation
- [.cursor/rules/](/.cursor/rules/) - AI assistant behavior rules
- [Noko API Documentation](https://api.nokotime.com/v2/) - Noko time tracking API reference 