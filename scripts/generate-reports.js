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
  const projects = process.env.PROJECTS ? process.env.PROJECTS.split(',').map(p => p.trim()) : ['CATIC', 'SDSU'];
  
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

function filterLsmEntries(entries) {
  return entries.filter(entry => {
    return !entry.tags.some(tag => 
      tag.name.toLowerCase().includes('internal') || 
      tag.name.toLowerCase().includes('sales')
    );
  });
}

// Function to generate raw data for LLM processing
function generateRawDataForLLM(days = 1, reportType = 'geekbot', quiet = false) {
  if (!quiet) {
    console.log(`📝 Generating raw data for LLM processing (${reportType})...`);
  }
  
  let rawData = '';
  const USER_ID = parseInt(process.env.NOKO_USER_ID) || 8372; // User's Noko user ID (configurable via env var)
  
  CONFIG.projects.forEach(project => {
    const nokoFile = path.join(CONFIG.dataDir, project, 'logs', `noko-${getCurrentDate()}.json`);
    const entries = readJsonFile(nokoFile);
    
    if (!entries || entries.length === 0) {
      return;
    }
    
    // Filter entries based on report type
    let filteredEntries;
    if (reportType === 'geekbot') {
      // For Geekbot: only user's LSM entries
      const lsmEntries = filterLsmEntries(entries);
      const userEntries = lsmEntries.filter(entry => entry.user.id === USER_ID);
      
      filteredEntries = userEntries.filter(entry => {
        const entryDate = new Date(entry.date);
        const today = new Date();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        // Compare just the date parts (YYYY-MM-DD) to avoid time component issues
        const entryDateStr = entryDate.toISOString().split('T')[0];
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
        const todayDateStr = today.toISOString().split('T')[0];
        
        const result = entryDateStr >= cutoffDateStr && entryDateStr <= todayDateStr;
        
        return result;
      });
    } else {
      // For other reports: all LSM entries
      const lsmEntries = filterLsmEntries(entries);
      filteredEntries = lsmEntries.filter(entry => {
        const entryDate = new Date(entry.date);
        const today = new Date();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
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
      const cleanGeekbot = generateRawDataForLLM(1, 'geekbot', true);
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