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
  
  // Project mapping configuration - maps discovered projects to report categories
  const projectMappings = parseProjectMappings();
  
  // Special bucket project IDs for LSM and Internal categorization
  const specialBuckets = {
    lsm: '560795',        // Main LSM Noko bucket
    internal: '17045',    // Internal Noko bucket  
    drainpipe: '687916',  // Drainpipe project
    lullabotdotcom: '550434' // Lullabotdotcom project
  };
  
  return {
    dataDir,
    projects,
    projectMappings,
    specialBuckets
  };
}

/**
 * Parse project mapping configuration from environment variables
 * 
 * Project mappings allow mapping discovered project directories to report categories.
 * This enables flexible reporting structures for different organizational setups.
 * 
 * Environment variable format:
 * PROJECT_MAPPINGS="DH:CATIC,GovHub:CATIC,MJFF:SDSU,LSM:General"
 * 
 * This would map:
 * - DH and GovHub projects → CATIC category
 * - MJFF projects → SDSU category  
 * - LSM projects → General category
 * 
 * @returns {Object} Mapping object with category names as keys and project arrays as values
 */
function parseProjectMappings() {
  const mappingStr = process.env.PROJECT_MAPPINGS || '';
  const projectToCategory = {};
  const categoryToProjects = {};
  
  if (mappingStr) {
    // Parse "DH:CATIC,GovHub:CATIC,MJFF:SDSU" format
    const pairs = mappingStr.split(',').map(pair => pair.trim());
    
    for (const pair of pairs) {
      const [project, category] = pair.split(':').map(s => s.trim());
      if (project && category) {
        projectToCategory[project] = category;
        
        if (!categoryToProjects[category]) {
          categoryToProjects[category] = [];
        }
        categoryToProjects[category].push(project);
      }
    }
  }
  
  return {
    projectToCategory,    // e.g., { "DH": "CATIC", "GovHub": "CATIC", "MJFF": "SDSU" }
    categoryToProjects,   // e.g., { "CATIC": ["DH", "GovHub"], "SDSU": ["MJFF"] }
    hasCustomMappings: Object.keys(projectToCategory).length > 0
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

/**
 * Enhanced categorization for geekbot reports
 * 
 * Categories:
 * 1. Client Projects: [LSM] prefixed projects (DH, GovHub, MJFF, etc.)
 * 2. LSM General: Administrative work + LSM bucket + drainpipe + lullabotdotcom (when not client-specific)
 * 3. Internal: #internal tagged + Internal bucket + company-wide activities
 * 4. Other: Any uncategorized entries (auto-categorized)
 */
function categorizeEntriesForGeekbot(allEntries, userId) {
  const categories = {
    clientProjects: {},  // Key = project name, Value = entries array
    lsm: [],            // General LSM activities
    internal: [],       // Internal activities  
    other: []           // Uncategorized entries
  };
  
  // Filter to user's entries only
  const userEntries = allEntries.filter(entry => entry.user.id === userId);
  
  userEntries.forEach(entry => {
    const projectId = entry.project?.id?.toString();
    const projectName = entry.project?.name || '';
    const tags = entry.tags || [];
    
    // Check for internal tags
    const hasInternalTag = tags.some(tag => 
      tag.name.toLowerCase().includes('internal') || 
      tag.name.toLowerCase().includes('sales')
    );
    
    // Category 1: Client Projects ([LSM] prefixed)
    if (projectName.includes('[LSM]')) {
      // Extract clean project name for grouping
      const cleanProjectName = projectName.replace(/^\[LSM\]\s*/, '').trim();
      // Try to match with discovered project directories
      // Enhanced matching: check directory name inclusion and common abbreviations
      const matchedProject = CONFIG.projects.find(proj => {
        const projLower = proj.toLowerCase();
        const nameLower = cleanProjectName.toLowerCase();
        
        // Direct containment check
        if (nameLower.includes(projLower) || projLower.includes(nameLower)) {
          return true;
        }
        
        // Common abbreviation patterns
        if (projLower === 'dh' && nameLower.includes('dartmouth')) return true;
        if (projLower === 'govhub' && nameLower.includes('georgia')) return true;
        if (projLower === 'mjff' && nameLower.includes('mjff')) return true;
        
        return false;
      });
      
      // Determine category key
      let categoryKey;
      
      // Apply project mapping if configured and matched project exists
      if (matchedProject && CONFIG.projectMappings.hasCustomMappings) {
        categoryKey = CONFIG.projectMappings.projectToCategory[matchedProject] || matchedProject;
      } else {
        // Fallback to matched project or first word of project name
        categoryKey = matchedProject || cleanProjectName.split(' ')[0];
      }
      
      if (!categories.clientProjects[categoryKey]) {
        categories.clientProjects[categoryKey] = [];
      }
      categories.clientProjects[categoryKey].push(entry);
      return;
    }
    
    // Category 3: Internal (check first since it's more specific)
    if (hasInternalTag || projectId === CONFIG.specialBuckets.internal) {
      categories.internal.push(entry);
      return;
    }
    
    // Category 2: LSM General
    if (projectId === CONFIG.specialBuckets.lsm || 
        projectId === CONFIG.specialBuckets.drainpipe ||
        projectId === CONFIG.specialBuckets.lullabotdotcom) {
      categories.lsm.push(entry);
      return;
    }
    
    // Category 4: Other - uncategorized entries (make best guess)
    categories.other.push(entry);
  });
  
  return categories;
}

// Function to generate raw data for LLM processing
function generateRawDataForLLM(days = 1, reportType = 'geekbot', quiet = false, excludeInternal = false) {
  if (!quiet) {
    console.log(`📝 Generating raw data for LLM processing (${reportType})...`);
    console.log(`📁 Discovered projects: ${CONFIG.projects.join(', ')}`);
    if (excludeInternal) {
      console.log(`🎯 Excluding Internal activities (LSM-only mode)`);
    }
  }
  
  let rawData = '';
  const USER_ID = parseInt(process.env.NOKO_USER_ID) || 8372; // User's Noko user ID (configurable via env var)
  
  // Calculate date range for filtering
  const today = new Date();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  // Collect all entries from all project directories
  let allEntries = [];
  
  CONFIG.projects.forEach(project => {
    const logsDir = path.join(CONFIG.dataDir, project, 'logs');
    
    if (!fs.existsSync(logsDir)) {
      return;
    }
    
    // Get all available Noko files
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
    }
  });
  
  if (allEntries.length === 0) {
    return rawData;
  }
  
  // Filter entries by date range
  const filteredEntries = allEntries.filter(entry => {
    const entryDate = new Date(entry.date);
    const entryDateStr = entryDate.toISOString().split('T')[0];
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0];
    const todayDateStr = today.toISOString().split('T')[0];
    
    return entryDateStr >= cutoffDateStr && entryDateStr <= todayDateStr;
  });
  
  if (reportType === 'geekbot') {
    // Use enhanced categorization for geekbot reports
    const categories = categorizeEntriesForGeekbot(filteredEntries, USER_ID);
    
    // Generate output in specified order: Projects, LSM, Internal
    
    // 1. Client Projects
    Object.keys(categories.clientProjects).sort().forEach(projectKey => {
      const entries = categories.clientProjects[projectKey];
      if (entries.length > 0) {
        rawData += `\n=== ${projectKey} ===\n`;
        entries.forEach(entry => {
          const timeFormatted = formatTime(entry.minutes);
          const user = `${entry.user.first_name} ${entry.user.last_name.charAt(0)}.`;
          rawData += `${timeFormatted} - ${user}: ${entry.description} (${entry.date})\n`;
        });
      }
    });
    
    // 2. LSM General
    if (categories.lsm.length > 0) {
      rawData += `\n=== LSM ===\n`;
      categories.lsm.forEach(entry => {
        const timeFormatted = formatTime(entry.minutes);
        const user = `${entry.user.first_name} ${entry.user.last_name.charAt(0)}.`;
        rawData += `${timeFormatted} - ${user}: ${entry.description} (${entry.date})\n`;
      });
    }
    
    // 3. Internal (conditionally included)
    if (!excludeInternal && categories.internal.length > 0) {
      rawData += `\n=== Internal ===\n`;
      categories.internal.forEach(entry => {
        const timeFormatted = formatTime(entry.minutes);
        const user = `${entry.user.first_name} ${entry.user.last_name.charAt(0)}.`;
        rawData += `${timeFormatted} - ${user}: ${entry.description} (${entry.date})\n`;
      });
    }
    
    // 4. Other (auto-categorize)
    if (categories.other.length > 0) {
      // Group by project name for uncategorized entries
      const otherGrouped = {};
      categories.other.forEach(entry => {
        const projectName = entry.project?.name || 'Uncategorized';
        if (!otherGrouped[projectName]) {
          otherGrouped[projectName] = [];
        }
        otherGrouped[projectName].push(entry);
      });
      
      Object.keys(otherGrouped).sort().forEach(projectName => {
        const entries = otherGrouped[projectName];
        rawData += `\n=== ${projectName} ===\n`;
        entries.forEach(entry => {
          const timeFormatted = formatTime(entry.minutes);
          const user = `${entry.user.first_name} ${entry.user.last_name.charAt(0)}.`;
          rawData += `${timeFormatted} - ${user}: ${entry.description} (${entry.date})\n`;
        });
      });
    }
    
  } else {
    // For other reports: use original LSM filtering approach
    const lsmEntries = filterLsmEntries(filteredEntries);
    const userEntries = lsmEntries.filter(entry => entry.user.id === USER_ID);
    
    if (userEntries.length > 0) {
      // Group by project for non-geekbot reports
      const projectGroups = {};
      userEntries.forEach(entry => {
        const projectName = entry.project?.name?.replace(/^\[LSM\]\s*/, '') || 'Unknown';
        if (!projectGroups[projectName]) {
          projectGroups[projectName] = [];
        }
        projectGroups[projectName].push(entry);
      });
      
      Object.keys(projectGroups).sort().forEach(projectName => {
        const entries = projectGroups[projectName];
        rawData += `\n=== ${projectName} ===\n`;
        entries.forEach(entry => {
          const timeFormatted = formatTime(entry.minutes);
          const user = `${entry.user.first_name} ${entry.user.last_name.charAt(0)}.`;
          rawData += `${timeFormatted} - ${user}: ${entry.description} (${entry.date})\n`;
        });
      });
    }
  }
  
  return rawData;
}

/**
 * Get configured project categories for report generation
 * 
 * Returns the categories that should be used in reports, either from 
 * project mappings or discovered projects.
 * 
 * @returns {Array} Array of category names for report generation
 */
function getReportCategories() {
  if (CONFIG.projectMappings.hasCustomMappings) {
    // Use categories from project mappings
    return Object.keys(CONFIG.projectMappings.categoryToProjects).sort();
  } else {
    // Fallback to discovered projects
    return CONFIG.projects.slice().sort();
  }
}

/**
 * Generate dynamic report template for weekly reports
 * 
 * Creates the template structure that will be used by the LLM to generate
 * clean reports with the correct project categories.
 * 
 * @returns {string} Template string for LLM processing
 */
function generateReportTemplate() {
  const categories = getReportCategories();
  
  let template = "**REPORT 1: LSM Office Hour Update**\n";
  
  // Generate office hour status for each category
  categories.forEach(category => {
    template += `${category} :large_green_circle:\n`;
    template += `- [clean summary without hashtags]\n\n`;
  });
  
  template += "**REPORT 2: LSM Weekly Update**\n";
  
  // Generate weekly update sections for each category
  categories.forEach(category => {
    template += `## ${category} Project Update\n`;
    template += `**This Week:** [summary of accomplishments]\n`;
    template += `**Status:** On track\n\n`;
  });
  
  return template.trim();
}

// Minimal CLI interface for LLM workflow
function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  
  switch (command) {
    case 'raw-geekbot':
      const rawDays = args[1] ? parseInt(args[1]) : 1;
      const rawExcludeInternal = args[2] === 'exclude-internal';
      const rawGeekbot = generateRawDataForLLM(rawDays, 'geekbot', false, rawExcludeInternal);
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
      const days = args[1] ? parseInt(args[1]) : 1;
      const excludeInternal = args[2] === 'exclude-internal';
      const cleanGeekbot = generateRawDataForLLM(days, 'geekbot', true, excludeInternal);
      console.log(cleanGeekbot || 'No entries found');
      break;
      
    case 'report-template':
      const template = generateReportTemplate();
      console.log('📋 Dynamic Report Template:');
      console.log('=' .repeat(60));
      console.log(template);
      console.log('=' .repeat(60));
      break;
      
    case 'report-categories':
      const categories = getReportCategories();
      console.log('📊 Configured Report Categories:');
      console.log(categories.join(', '));
      if (CONFIG.projectMappings.hasCustomMappings) {
        console.log('\n📋 Project Mappings:');
        Object.entries(CONFIG.projectMappings.projectToCategory).forEach(([project, category]) => {
          console.log(`  ${project} → ${category}`);
        });
      }
      break;
      
    case 'help':
    default:
      console.log(`
📊 LLM Report Data Generator

  node generate-reports.js <command> [options]

Commands:
  raw-geekbot [days] [exclude-internal]    Generate raw data for LLM processing (Geekbot, default: 1 day)
  raw-weekly                               Generate raw data for LLM processing (Weekly, 7 days)
  clean-geekbot [days] [exclude-internal]  Generate clean data for LLM (Geekbot, no headers)
  clean-weekly                             Generate clean data for LLM (Weekly, no headers)
  report-template                          Generate dynamic report template for weekly reports
  report-categories                        Show configured report categories and project mappings
  help                                     Show this help message

Options:
  exclude-internal     Exclude Internal activities from geekbot reports
                       (useful for part-time CS/LSM users)

Examples:
  node generate-reports.js raw-geekbot 1
  node generate-reports.js clean-geekbot 2 exclude-internal
  node generate-reports.js clean-weekly
  node generate-reports.js report-template
  node generate-reports.js report-categories
      `);
      break;
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  generateRawDataForLLM,
  getReportCategories,
  generateReportTemplate
}; 