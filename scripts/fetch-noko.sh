#!/bin/bash

# Noko API fetcher with flexible date ranges and project handling
# Usage: ./fetch-noko.sh [project_name] [days_back] [format]
# Examples:
#   ./fetch-noko.sh CATIC 7 md     # Last 7 days, markdown format
#   ./fetch-noko.sh SDSU 1 json    # Yesterday, JSON format
#   ./fetch-noko.sh both 7 md      # Both projects, last 7 days

set -e

# Load environment variables from .env file if it exists
if [ -f ".env" ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Configuration - Load from environment variables
if [ -z "$NOKO_API_TOKEN" ]; then
    echo "❌ Error: NOKO_API_TOKEN environment variable is not set"
    echo "   Please set your Noko API token:"
    echo "   export NOKO_API_TOKEN=your_token_here"
    echo ""
    echo "   Or create a .env file with:"
    echo "   NOKO_API_TOKEN=your_token_here"
    exit 1
fi

NOKO_TOKEN="$NOKO_API_TOKEN"
BASE_URL="https://api.nokotime.com/v2"

# Function to get project ID
get_project_id() {
    local project_name="$1"
    local env_var="${project_name}_PROJECT_ID"
    local project_id="${!env_var}"
    
    if [ -z "$project_id" ]; then
        echo "❌ Project ID not found for $project_name. Please set ${env_var} in your .env file."
        return 1
    fi
    
    echo "$project_id"
}

# Configuration
DATA_DIR="${DATA_DIR:-./data}"
PROJECTS="${PROJECTS:-CATIC,SDSU}"
DEFAULT_DAYS_BACK="${DEFAULT_DAYS_BACK:-7}"

# Default parameters
PROJECT_NAME=${1:-"both"}
DAYS_BACK=${2:-$DEFAULT_DAYS_BACK}
OUTPUT_FORMAT=${3:-"md"}

# Function to get date range
get_dates() {
    local days_back=$1
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        START_DATE=$(date -v-${days_back}d +%Y-%m-%d)
        END_DATE=$(date +%Y-%m-%d)
    else
        # Linux
        START_DATE=$(date -d "${days_back} days ago" +%Y-%m-%d)
        END_DATE=$(date +%Y-%m-%d)
    fi
    
    echo "$START_DATE $END_DATE"
}

# Function to fetch Noko data
fetch_noko_data() {
    local project_id=$1
    local start_date=$2
    local end_date=$3
    
    curl -s -H "X-NokoToken: $NOKO_TOKEN" \
        "${BASE_URL}/projects/${project_id}/entries?from=${start_date}&to=${end_date}&per_page=1000"
}

# Function to convert JSON to markdown format
json_to_markdown() {
    local json_data=$1
    local project_name=$2
    
    echo "$json_data" | jq -r --arg project "$project_name" '
        sort_by(.date) | reverse | 
        .[] | 
        "\(.minutes | if . >= 60 then "\(. / 60 | floor)h\(if . % 60 > 0 then " \(. % 60)m" else "" end)" else "\(.)m" end)\t\n[\($project)] \(.project.name)\n\(.user.first_name) \(.user.last_name[0:1]).\t\(.tags // [] | map(.formatted_name) | join(" ")) \(.description)\t\(.date | strptime("%Y-%m-%d") | strftime("%b %d"))\t"
    '
}

# Function to save data
save_data() {
    local project_name=$1
    local data=$2
    local format=$3
    local end_date=$4
    
    local output_dir="${DATA_DIR}/${project_name}/logs"
    local filename="noko-${end_date}.${format}"
    local filepath="${output_dir}/${filename}"
    
    # Create directory if it doesn't exist
    mkdir -p "$output_dir"
    
    # Save data
    echo "$data" > "$filepath"
    echo "✅ Saved ${project_name} data to: $filepath"
}

# Main execution
main() {
    echo "🔄 Fetching Noko data..."
    echo "Project: $PROJECT_NAME | Days back: $DAYS_BACK | Format: $OUTPUT_FORMAT"
    
    # Get date range
    dates=($(get_dates $DAYS_BACK))
    START_DATE=${dates[0]}
    END_DATE=${dates[1]}
    
    echo "📅 Date range: $START_DATE to $END_DATE"
    
    # Process projects
    if [[ "$PROJECT_NAME" == "both" ]]; then
        IFS=',' read -ra projects <<< "$PROJECTS"
        # Trim whitespace from each project name
        for i in "${!projects[@]}"; do
            projects[i]=$(echo "${projects[i]}" | xargs)
        done
    else
        projects=("$PROJECT_NAME")
    fi
    
    for project in "${projects[@]}"; do
        project_id=$(get_project_id "$project")
        if [[ -z "$project_id" ]]; then
            echo "❌ Unknown project: $project"
            continue
        fi
        
        echo "📊 Fetching $project data (ID: $project_id)..."
        
        # Fetch data
        json_data=$(fetch_noko_data "$project_id" "$START_DATE" "$END_DATE")
        
        if [[ "$json_data" == "[]" ]]; then
            echo "ℹ️  No entries found for $project"
            continue
        fi
        
        # Process and save data
        if [[ "$OUTPUT_FORMAT" == "md" ]]; then
            markdown_data=$(json_to_markdown "$json_data" "$project")
            save_data "$project" "$markdown_data" "md" "$END_DATE"
        else
            save_data "$project" "$json_data" "json" "$END_DATE"
        fi
    done
    
    echo "✅ Noko fetch completed!"
}

# Run main function
main "$@" 