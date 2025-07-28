#!/usr/bin/env node

/**
 * GovHub Team Analysis Tool
 * 
 * Analyzes team-wide resource utilization for SOW planning and meetings.
 * Breaks down hours by team member, maintenance vs professional services,
 * and provides capacity analysis against SOW expectations.
 */

// Load environment variables
if (require('fs').existsSync('.env')) {
  try {
    require('dotenv').config();
  } catch (error) {
    const envContent = require('fs').readFileSync('.env', 'utf8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^#][^=]*)=(.*)$/);
      if (match) {
        process.env[match[1].trim()] = match[2].trim();
      }
    });
  }
}

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  dataDir: process.env.DATA_DIR || './data',
  projectName: 'GovHub',
  sowStartDate: '2025-04-01',
  sowMonthlyHours: 200, // From SOW Chart 4
  sowHourlyRate: 175,
  sowMonthlyBudget: 35000
};

// Utility functions
function getCurrentDate() {
  return new Date().toISOString().split('T')[0];
}

function formatTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function formatHours(minutes) {
  return (minutes / 60).toFixed(1);
}

function readJsonFile(filepath) {
  try {
    if (fs.existsSync(filepath)) {
      const content = fs.readFileSync(filepath, 'utf8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn(`⚠️  Could not read ${filepath}: ${error.message}`);
  }
  return null;
}

function parseDate(dateString) {
  return new Date(dateString);
}

function isDateInRange(dateString, startDate, endDate = null) {
  const date = parseDate(dateString);
  const start = parseDate(startDate);
  const end = endDate ? parseDate(endDate) : new Date();
  return date >= start && date <= end;
}

// Load all team data
function loadTeamData(startDate = CONFIG.sowStartDate, endDate = null) {
  const logsDir = path.join(CONFIG.dataDir, CONFIG.projectName, 'logs');
  const allEntries = [];
  
  if (!fs.existsSync(logsDir)) {
    console.error(`❌ Data directory not found: ${logsDir}`);
    return [];
  }
  
  const files = fs.readdirSync(logsDir)
    .filter(file => file.startsWith('noko-') && file.endsWith('.json'))
    .sort();
  
  console.log(`📂 Found ${files.length} data files`);
  
  files.forEach(file => {
    const filepath = path.join(logsDir, file);
    const data = readJsonFile(filepath);
    if (data && Array.isArray(data)) {
      // Filter by date range
      const filteredData = data.filter(entry => 
        isDateInRange(entry.date, startDate, endDate)
      );
      allEntries.push(...filteredData);
    }
  });
  
  console.log(`📊 Loaded ${allEntries.length} total entries since ${startDate}`);
  return allEntries;
}

// Categorize work types
function categorizeWorkType(entry) {
  const tags = entry.tags || [];
  const description = entry.description || '';
  
  // Professional Services indicators
  const professionalTags = ['professional', 'consulting', 'strategy', 'design'];
  const professionalKeywords = [
    'behat', 'playwright', 'migration', 'upgrade', 'drupal 11', 
    'govhub 2.0', 'initiative', 'acn', 'cloud next', 'storybook',
    'orchard', 'auth0', 'siteimprove', 'figma'
  ];
  
  // Check for explicit professional tags
  const hasProTag = tags.some(tag => 
    professionalTags.some(pt => tag.name.toLowerCase().includes(pt))
  );
  
  // Check for professional keywords in description
  const hasProKeywords = professionalKeywords.some(keyword =>
    description.toLowerCase().includes(keyword)
  );
  
  if (hasProTag || hasProKeywords) {
    return 'Professional Services';
  }
  
  // Default to maintenance
  return 'Support & Maintenance';
}

// Analyze team performance
function analyzeTeamData(entries) {
  const analysis = {
    summary: {
      totalHours: 0,
      totalEntries: entries.length,
      dateRange: {
        start: CONFIG.sowStartDate,
        end: getCurrentDate()
      },
      monthsAnalyzed: 0
    },
    byTeamMember: {},
    byWorkType: {
      'Support & Maintenance': { hours: 0, entries: 0 },
      'Professional Services': { hours: 0, entries: 0 }
    },
    byMonth: {},
    capacity: {}
  };
  
  // Calculate months since SOW start
  const sowStart = parseDate(CONFIG.sowStartDate);
  const now = new Date();
  analysis.summary.monthsAnalyzed = ((now.getFullYear() - sowStart.getFullYear()) * 12 
    + (now.getMonth() - sowStart.getMonth())) + 1;
  
  entries.forEach(entry => {
    const hours = entry.minutes / 60;
    const workType = categorizeWorkType(entry);
    const userName = `${entry.user.first_name} ${entry.user.last_name}`;
    const monthKey = entry.date.substring(0, 7); // YYYY-MM
    
    // Total hours
    analysis.summary.totalHours += hours;
    
    // By team member
    if (!analysis.byTeamMember[userName]) {
      analysis.byTeamMember[userName] = {
        hours: 0,
        entries: 0,
        email: entry.user.email,
        workTypes: {
          'Support & Maintenance': { hours: 0, entries: 0 },
          'Professional Services': { hours: 0, entries: 0 }
        }
      };
    }
    analysis.byTeamMember[userName].hours += hours;
    analysis.byTeamMember[userName].entries += 1;
    analysis.byTeamMember[userName].workTypes[workType].hours += hours;
    analysis.byTeamMember[userName].workTypes[workType].entries += 1;
    
    // By work type
    analysis.byWorkType[workType].hours += hours;
    analysis.byWorkType[workType].entries += 1;
    
    // By month
    if (!analysis.byMonth[monthKey]) {
      analysis.byMonth[monthKey] = {
        hours: 0,
        entries: 0,
        workTypes: {
          'Support & Maintenance': { hours: 0, entries: 0 },
          'Professional Services': { hours: 0, entries: 0 }
        }
      };
    }
    analysis.byMonth[monthKey].hours += hours;
    analysis.byMonth[monthKey].entries += 1;
    analysis.byMonth[monthKey].workTypes[workType].hours += hours;
    analysis.byMonth[monthKey].workTypes[workType].entries += 1;
  });
  
  // Capacity analysis
  const expectedTotalHours = CONFIG.sowMonthlyHours * analysis.summary.monthsAnalyzed;
  analysis.capacity = {
    expectedHours: expectedTotalHours,
    actualHours: analysis.summary.totalHours,
    utilizationRate: (analysis.summary.totalHours / expectedTotalHours * 100).toFixed(1),
    remainingCapacity: expectedTotalHours - analysis.summary.totalHours,
    avgMonthlyHours: (analysis.summary.totalHours / analysis.summary.monthsAnalyzed).toFixed(1),
    expectedMonthlyHours: CONFIG.sowMonthlyHours
  };
  
  return analysis;
}

// Generate summary report for meetings
function generateSummaryReport(analysis) {
  const report = [];
  
  report.push('# GovHub Team Resource Analysis Summary');
  report.push('*Generated for SOW planning and client meetings*\n');
  
  // Key Metrics
  report.push('## 📊 Key Metrics');
  report.push(`- **Analysis Period**: ${analysis.summary.dateRange.start} to ${analysis.summary.dateRange.end}`);
  report.push(`- **Months Analyzed**: ${analysis.summary.monthsAnalyzed}`);
  report.push(`- **Total Hours Used**: ${analysis.summary.totalHours.toFixed(1)} hours`);
  report.push(`- **SOW Utilization**: ${analysis.capacity.utilizationRate}% of contracted capacity`);
  report.push(`- **Remaining Capacity**: ${analysis.capacity.remainingCapacity.toFixed(1)} hours\n`);
  
  // Capacity Analysis
  report.push('## 🎯 SOW Capacity Analysis');
  report.push(`- **Expected Hours/Month**: ${CONFIG.sowMonthlyHours} hours`);
  report.push(`- **Actual Average/Month**: ${analysis.capacity.avgMonthlyHours} hours`);
  report.push(`- **Under-utilization**: ${(CONFIG.sowMonthlyHours - parseFloat(analysis.capacity.avgMonthlyHours)).toFixed(1)} hours/month`);
  
  if (parseFloat(analysis.capacity.utilizationRate) < 100) {
    report.push('\n💡 **Key Finding**: Team is operating below SOW capacity - room for growth without additional resources.');
  } else {
    report.push('\n⚠️ **Key Finding**: Team is at or above SOW capacity - may need additional resources for new initiatives.');
  }
  report.push('');
  
  // Work Type Breakdown
  report.push('## 🔧 Work Type Distribution');
  const maintenanceHours = analysis.byWorkType['Support & Maintenance'].hours;
  const professionalHours = analysis.byWorkType['Professional Services'].hours;
  const maintenancePercent = (maintenanceHours / analysis.summary.totalHours * 100).toFixed(1);
  const professionalPercent = (professionalHours / analysis.summary.totalHours * 100).toFixed(1);
  
  report.push(`- **Support & Maintenance**: ${maintenanceHours.toFixed(1)} hours (${maintenancePercent}%)`);
  report.push(`- **Professional Services**: ${professionalHours.toFixed(1)} hours (${professionalPercent}%)`);
  report.push('');
  
  // Team Member Summary
  report.push('## 👥 Team Resource Utilization');
  const sortedMembers = Object.entries(analysis.byTeamMember)
    .sort((a, b) => b[1].hours - a[1].hours);
  
  sortedMembers.forEach(([name, data]) => {
    const hoursPerMonth = (data.hours / analysis.summary.monthsAnalyzed).toFixed(1);
    const maintenance = data.workTypes['Support & Maintenance'].hours.toFixed(1);
    const professional = data.workTypes['Professional Services'].hours.toFixed(1);
    
    report.push(`- **${name}**: ${data.hours.toFixed(1)}h total (${hoursPerMonth}h/month)`);
    report.push(`  - Maintenance: ${maintenance}h | Professional: ${professional}h`);
  });
  report.push('');
  
  // Recommendations
  report.push('## 🎯 Recommendations for JE Meeting');
  
  if (parseFloat(analysis.capacity.utilizationRate) < 80) {
    report.push('1. **Scale Current Team**: Under-utilizing SOW capacity - can increase current team hours');
    report.push('2. **Accommodate Initiatives**: Room for new initiatives within existing contract');
    report.push('3. **No Additional CS Resources Needed**: Current maintenance team can handle expanded scope');
  } else if (parseFloat(analysis.capacity.utilizationRate) < 100) {
    report.push('1. **Optimize Current Resources**: Approaching SOW limits but still have capacity');
    report.push('2. **Selective Initiative Prioritization**: Can handle some new initiatives');
    report.push('3. **Monitor Capacity**: May need CS resources for significant scope expansion');
  } else {
    report.push('1. **Consider Client Services Resources**: At/above SOW capacity');
    report.push('2. **Reduce Maintenance Hours**: To accommodate new initiatives within budget');
    report.push('3. **SOW Amendment**: May need additional budget for expanded scope');
  }
  
  return report.join('\n');
}

// Generate detailed report
function generateDetailedReport(analysis) {
  const report = [];
  
  report.push('# GovHub Team Analysis - Detailed Report\n');
  
  // Monthly Breakdown
  report.push('## 📅 Monthly Hour Distribution');
  const sortedMonths = Object.entries(analysis.byMonth).sort();
  
  sortedMonths.forEach(([month, data]) => {
    const maintenance = data.workTypes['Support & Maintenance'].hours.toFixed(1);
    const professional = data.workTypes['Professional Services'].hours.toFixed(1);
    
    report.push(`### ${month}`);
    report.push(`- Total: ${data.hours.toFixed(1)} hours (${data.entries} entries)`);
    report.push(`- Maintenance: ${maintenance}h | Professional: ${professional}h`);
    report.push('');
  });
  
  // Individual Team Member Details
  report.push('## 👤 Individual Team Member Analysis');
  
  Object.entries(analysis.byTeamMember)
    .sort((a, b) => b[1].hours - a[1].hours)
    .forEach(([name, data]) => {
      report.push(`### ${name} (${data.email})`);
      report.push(`- **Total Hours**: ${data.hours.toFixed(1)} (${data.entries} entries)`);
      report.push(`- **Monthly Average**: ${(data.hours / analysis.summary.monthsAnalyzed).toFixed(1)} hours`);
      report.push(`- **Support & Maintenance**: ${data.workTypes['Support & Maintenance'].hours.toFixed(1)}h`);
      report.push(`- **Professional Services**: ${data.workTypes['Professional Services'].hours.toFixed(1)}h`);
      report.push('');
    });
  
  return report.join('\n');
}

// Main function
function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'summary';
  const startDate = args[1] || CONFIG.sowStartDate;
  const endDate = args[2] || null;
  
  console.log(`🔍 Analyzing GovHub team data since ${startDate}...`);
  
  const entries = loadTeamData(startDate, endDate);
  
  if (entries.length === 0) {
    console.log('❌ No data found. Try fetching more data first:');
    console.log('   npm run fetch');
    return;
  }
  
  const analysis = analyzeTeamData(entries);
  
  switch (command) {
    case 'summary':
      console.log('\n' + generateSummaryReport(analysis));
      break;
      
    case 'detailed':
      console.log('\n' + generateDetailedReport(analysis));
      break;
      
    case 'both':
      console.log('\n' + generateSummaryReport(analysis));
      console.log('\n' + '='.repeat(80));
      console.log('\n' + generateDetailedReport(analysis));
      break;
      
    case 'json':
      console.log(JSON.stringify(analysis, null, 2));
      break;
      
    case 'help':
    default:
      console.log(`
🏢 GovHub Team Analysis Tool

Usage: node scripts/team-analysis.js <command> [start_date] [end_date]

Commands:
  summary     Generate summary report for meetings (default)
  detailed    Generate detailed breakdown report
  both        Generate both summary and detailed reports
  json        Output raw analysis data as JSON
  help        Show this help message

Examples:
  node scripts/team-analysis.js summary
  node scripts/team-analysis.js both 2025-04-01
  node scripts/team-analysis.js detailed 2025-06-01 2025-07-31
      `);
      break;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  analyzeTeamData,
  loadTeamData,
  generateSummaryReport,
  generateDetailedReport
}; 