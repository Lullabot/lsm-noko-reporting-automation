#!/usr/bin/env node

// Load environment variables
if (require('fs').existsSync('.env')) {
  try {
    // Try to use dotenv if available
    require('dotenv').config();
  } catch (error) {
    // Fallback to manual parsing
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
const { execSync } = require('child_process');

// Configuration
function getConfig() {
  const dataDir = process.env.DATA_DIR || './data';
  
  // Dynamic project discovery from data directory
  let projects = [];
  try {
    if (fs.existsSync(dataDir)) {
      projects = fs.readdirSync(dataDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name)
        .filter(name => !name.startsWith('.'));
    }
  } catch (error) {
    console.warn(`⚠️  Could not read data directory ${dataDir}: ${error.message}`);
  }
  
  // Fallback to environment variable or previous defaults if no projects found
  if (projects.length === 0) {
    projects = process.env.PROJECTS ? process.env.PROJECTS.split(',').map(p => p.trim()) : ['CATIC', 'SDSU'];
    console.warn(`⚠️  No project directories found in ${dataDir}, using: ${projects.join(', ')}`);
  }
  
  return {
    dataDir,
    projects
  };
}

const CONFIG = getConfig();

// Utility function to ensure directories exist
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Utility functions
function getCurrentDate() {
  return new Date().toISOString().split('T')[0];
}

function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

function formatTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
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

function readMemoryBank(project) {
  const memoryBankPath = path.join(CONFIG.dataDir, project, 'memory-bank');
  const memoryBank = {};
  
  try {
    const files = ['activeContext.md', 'progress.md', 'productContext.md'];
    files.forEach(file => {
      const filePath = path.join(memoryBankPath, file);
      if (fs.existsSync(filePath)) {
        memoryBank[file.replace('.md', '')] = fs.readFileSync(filePath, 'utf8');
      }
    });
  } catch (error) {
    console.warn(`⚠️  Could not read memory bank for ${project}: ${error.message}`);
  }
  
  return memoryBank;
}

/**
 * Enhanced LSM filtering logic
 * 
 * LSM = Lullabot Support and Maintenance Department
 * 
 * Primary identification: Noko project names with "[LSM]" prefix
 * Secondary: Configurable project patterns and tag exclusions
 * 
 * Edge cases handled:
 * - LSM work sometimes logged to non-LSM Noko buckets (drainpipe, lullabotdotcom)
 * - Context-dependent classification (LSM folks vs others)
 */
function filterLsmEntries(entries) {
  // Primary filter: Look for "[LSM]" prefix in project names
  const lsmByProjectName = entries.filter(entry => {
    return entry.project && entry.project.name && entry.project.name.includes('[LSM]');
  });
  
  // Secondary filter: Exclude entries explicitly tagged as internal/sales
  // (Some LSM work might be logged to other buckets but still be LSM work)
  const lsmByExclusion = entries.filter(entry => {
    // Skip if already included by project name
    if (entry.project && entry.project.name && entry.project.name.includes('[LSM]')) {
      return false;
    }
    
    // Check for explicit exclusion tags
    const hasExclusionTags = entry.tags && entry.tags.some(tag => 
      tag.name.toLowerCase().includes('internal') || 
      tag.name.toLowerCase().includes('sales')
    );
    
    // Include if no exclusion tags (might be LSM work in other buckets)
    // Note: This is conservative - actual classification may depend on context
    return !hasExclusionTags;
  });
  
  // Combine both filters and remove duplicates
  const allLsmEntries = [...lsmByProjectName, ...lsmByExclusion];
  const uniqueEntries = allLsmEntries.filter((entry, index, self) => 
    index === self.findIndex(e => e.id === entry.id)
  );
  
  return uniqueEntries;
}

// Function to generate raw data for LLM processing
function generateRawDataForLLM(days = 1, reportType = 'geekbot', quiet = false) {
  if (!quiet) {
    console.log(`📝 Generating raw data for LLM processing (${reportType})...`);
    console.log(`📁 Discovered projects: ${CONFIG.projects.join(', ')}`);
  }
  
  let rawData = '';
  const USER_ID = parseInt(process.env.NOKO_USER_ID) || 8372; // User's Noko user ID (configurable via env var)
  
  // Calculate date range for filtering
  const today = new Date();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  CONFIG.projects.forEach(project => {
    const logsDir = path.join(CONFIG.dataDir, project, 'logs');
    
    if (!fs.existsSync(logsDir)) {
      return;
    }
    
    // Get all available Noko files
    let allEntries = [];
    try {
      const files = fs.readdirSync(logsDir)
        .filter(file => file.startsWith('noko-') && file.endsWith('.json'))
        .sort(); // Sort to process chronologically
      
      for (const file of files) {
        const filePath = path.join(logsDir, file);
        const entries = readJsonFile(filePath);
        if (entries && Array.isArray(entries)) {
          allEntries = allEntries.concat(entries);
        }
      }
    } catch (error) {
      console.warn(`⚠️  Could not read logs directory for ${project}: ${error.message}`);
      return;
    }
    
    if (allEntries.length === 0) {
      return;
    }
    
    // Filter entries based on report type
    let filteredEntries;
    if (reportType === 'geekbot') {
      // For Geekbot: only user's LSM entries
      const lsmEntries = filterLsmEntries(allEntries);
      const userEntries = lsmEntries.filter(entry => entry.user.id === USER_ID);
      
      filteredEntries = userEntries.filter(entry => {
        const entryDate = new Date(entry.date);
        
        // Compare just the date parts (YYYY-MM-DD) to avoid time component issues
        const entryDateStr = entryDate.toISOString().split('T')[0];
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
        const todayDateStr = today.toISOString().split('T')[0];
        
        const result = entryDateStr >= cutoffDateStr && entryDateStr <= todayDateStr;
        
        return result;
      });
    } else {
      // For other reports: all LSM entries
      const lsmEntries = filterLsmEntries(allEntries);
      filteredEntries = lsmEntries.filter(entry => {
        const entryDate = new Date(entry.date);
        
        // Compare just the date parts (YYYY-MM-DD) to avoid time component issues
        const entryDateStr = entryDate.toISOString().split('T')[0];
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
        const todayDateStr = today.toISOString().split('T')[0];
        
        return entryDateStr >= cutoffDateStr && entryDateStr <= todayDateStr;
      });
    }
    
    if (filteredEntries.length > 0) {
      rawData += `\n=== ${project} ===\n`;
      filteredEntries.forEach(entry => {
        const timeFormatted = formatTime(entry.minutes);
        const user = `${entry.user.first_name} ${entry.user.last_name.charAt(0)}.`;
        const projectName = entry.project.name.replace(/^\[LSM\]\s*/, ''); // Clean up project name for display
        rawData += `${timeFormatted} - ${user}: ${entry.description} (${entry.date})\n`;
      });
    }
  });
  
  return rawData;
}

// Minimal CLI interface for LLM workflow
function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  
  switch (command) {
    case 'raw-geekbot':
      const rawGeekbot = generateRawDataForLLM(args[1] ? parseInt(args[1]) : 1, 'geekbot');
      console.log('📋 Raw Geekbot Data:');
      console.log('=' .repeat(60));
      console.log(rawGeekbot || 'No entries found');
      console.log('=' .repeat(60));
      break;
      
    case 'raw-weekly':
      const rawWeekly = generateRawDataForLLM(7, 'weekly');
      console.log('📋 Raw Weekly Data:');
      console.log('=' .repeat(60));
      console.log(rawWeekly || 'No entries found');
      console.log('=' .repeat(60));
      break;
      
    case 'clean-weekly':
      const cleanWeekly = generateRawDataForLLM(7, 'weekly', true);
      console.log(cleanWeekly || 'No entries found');
      break;
      
    case 'clean-geekbot':
      const cleanGeekbot = generateRawDataForLLM(args[1] ? parseInt(args[1]) : 1, 'geekbot', true);
      console.log(cleanGeekbot || 'No entries found');
      break;
      
    case 'help':
    default:
      console.log(`
📊 LLM Report Data Generator

  node generate-reports.js <command> [options]

Commands:
  raw-geekbot [days] Generate raw data for LLM processing (Geekbot, default: 1 day)
  raw-weekly         Generate raw data for LLM processing (Weekly, 7 days)
  clean-geekbot      Generate clean data for LLM (Geekbot, no headers)
  clean-weekly       Generate clean data for LLM (Weekly, no headers)
  help               Show this help message

Examples:
  node generate-reports.js raw-geekbot 1
  node generate-reports.js clean-weekly
      `);
      break;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  generateRawDataForLLM
}; 