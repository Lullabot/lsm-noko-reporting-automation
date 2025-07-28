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
  sowEndDate: '2026-06-30', // 15 month contract
  sowTotalHours: 3000, // From hours.csv "Current SOW SAL-152"
  sowMonthlyHours: 200, // From SOW Chart 4
  sowHourlyRate: 175,
  sowMonthlyBudget: 35000,
  // Real usage from hours.csv for context
  actualUsageFromCSV: {
    totalHours: 947.75,
    monthsComplete: 4, // Apr-Jul
    monthsRemaining: 11,
    hoursRemaining: 2052.25
  }
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
  
  // Capacity analysis - updated for 15-month SOW
  const sowStart = parseDate(CONFIG.sowStartDate);
  const sowEnd = parseDate(CONFIG.sowEndDate);
  const now = new Date();
  
  // Calculate months into SOW (more accurate)
  const monthsIntoSOW = ((now.getFullYear() - sowStart.getFullYear()) * 12 
    + (now.getMonth() - sowStart.getMonth())) + 1;
  
  // Expected hours based on time elapsed
  const expectedHoursByTime = CONFIG.sowMonthlyHours * monthsIntoSOW;
  
  analysis.capacity = {
    // SOW Contract Details
    contractTotalHours: CONFIG.sowTotalHours,
    contractMonths: 15,
    contractMonthlyHours: CONFIG.sowMonthlyHours,
    
    // Time-based Analysis (from log data - LIMITED)
    logDataHours: analysis.summary.totalHours,
    logDataMonths: analysis.summary.monthsAnalyzed,
    logDataUtilization: (analysis.summary.totalHours / expectedHoursByTime * 100).toFixed(1),
    
    // Real Usage (from hours.csv context)
    actualTotalUsed: CONFIG.actualUsageFromCSV.totalHours,
    actualMonthsComplete: CONFIG.actualUsageFromCSV.monthsComplete,
    actualUtilization: (CONFIG.actualUsageFromCSV.totalHours / CONFIG.sowTotalHours * 100).toFixed(1),
    actualMonthlyAverage: (CONFIG.actualUsageFromCSV.totalHours / CONFIG.actualUsageFromCSV.monthsComplete).toFixed(1),
    
    // Projections
    hoursRemaining: CONFIG.actualUsageFromCSV.hoursRemaining,
    monthsRemaining: CONFIG.actualUsageFromCSV.monthsRemaining,
    avgHoursNeededPerMonth: (CONFIG.actualUsageFromCSV.hoursRemaining / CONFIG.actualUsageFromCSV.monthsRemaining).toFixed(1),
    
    // Capacity Status
    onTrackForSOW: CONFIG.actualUsageFromCSV.totalHours / CONFIG.actualUsageFromCSV.monthsComplete <= CONFIG.sowMonthlyHours,
    capacityStatus: CONFIG.actualUsageFromCSV.totalHours < (CONFIG.actualUsageFromCSV.monthsComplete * CONFIG.sowMonthlyHours) ? 'under' : 'over'
  };
  
  return analysis;
}

// Generate summary report for meetings
function generateSummaryReport(analysis) {
  const report = [];
  
  report.push('# GovHub Team Resource Analysis Summary');
  report.push('*Generated for SOW planning and client meetings*\n');
  
  // Key Metrics - Updated for accuracy
  report.push('## 📊 Key Metrics');
  report.push(`- **Analysis Period**: ${analysis.summary.dateRange.start} to ${analysis.summary.dateRange.end}`);
  report.push(`- **SOW Contract**: 15 months, 3000 hours total`);
  report.push(`- **Actual Usage (from hours.csv)**: ${analysis.capacity.actualTotalUsed} hours (${analysis.capacity.actualUtilization}% of contract)`);
  report.push(`- **Log Data Available**: ${analysis.summary.totalHours.toFixed(1)} hours (limited recent data)`);
  report.push(`- **Months Remaining**: ${analysis.capacity.monthsRemaining} months`);
  report.push(`- **Hours Remaining**: ${analysis.capacity.hoursRemaining} hours\n`);
  
  // Capacity Analysis - Corrected
  report.push('## 🎯 SOW Capacity Analysis (Based on hours.csv Reality)');
  report.push(`- **Contracted Hours/Month**: ${CONFIG.sowMonthlyHours} hours`);
  report.push(`- **Actual Average/Month**: ${analysis.capacity.actualMonthlyAverage} hours`);
  report.push(`- **Hours Needed/Month (remaining)**: ${analysis.capacity.avgHoursNeededPerMonth} hours`);
  report.push(`- **Current Pace**: ${analysis.capacity.capacityStatus === 'under' ? 'Slightly under' : 'At/over'} SOW monthly target`);
  
  // Updated recommendations based on real data
  const utilizationRate = parseFloat(analysis.capacity.actualUtilization);
  const monthlyNeeded = parseFloat(analysis.capacity.avgHoursNeededPerMonth);
  
  if (monthlyNeeded <= CONFIG.sowMonthlyHours * 0.9) {
    report.push('\n💡 **Key Finding**: Room for modest growth - can accommodate some new initiatives within SOW.');
  } else if (monthlyNeeded <= CONFIG.sowMonthlyHours) {
    report.push('\n⚖️ **Key Finding**: Operating near SOW capacity - need careful prioritization for new initiatives.');
  } else {
    report.push('\n⚠️ **Key Finding**: Would exceed SOW monthly capacity - may need resource strategy adjustments.');
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
  
  // Recommendations - Updated for realistic capacity
  report.push('## 🎯 Recommendations for JE Meeting');
  
  const monthlyNeeded = parseFloat(analysis.capacity.avgHoursNeededPerMonth);
  const currentMonthly = parseFloat(analysis.capacity.actualMonthlyAverage);
  
  if (monthlyNeeded <= CONFIG.sowMonthlyHours * 0.85) {
    report.push('1. **Moderate Capacity Available**: Can accommodate select new initiatives');
    report.push('2. **Prioritize Initiatives**: Choose highest-value professional services work');
    report.push('3. **Scale Gradually**: Increase team utilization within SOW limits');
  } else if (monthlyNeeded <= CONFIG.sowMonthlyHours * 0.95) {
    report.push('1. **Limited Additional Capacity**: Approaching SOW monthly limits');
    report.push('2. **Strategic Initiative Selection**: Focus on initiatives already in Professional Services scope');
    report.push('3. **Consider Trade-offs**: May need to reduce some maintenance scope for major initiatives');
  } else {
    report.push('1. **At SOW Capacity**: Additional initiatives may require resource adjustments');
    report.push('2. **Client Services Option**: Consider CS resources for specialized initiatives');
    report.push('3. **SOW Discussion**: May need to discuss scope adjustments with customer');
  }
  
  // Add context about data limitations
  report.push('\n**📝 Note**: This analysis uses hours.csv data (947.75h actual) as log data only covers recent period.');
  
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