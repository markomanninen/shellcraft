#!/bin/bash
# inspect-ci-failures.sh
# Inspects GitHub Actions workflow failures and generates a report for fixing
#
# Usage: ./scripts/inspect-ci-failures.sh [--limit N] [--json] [--output FILE]
#
# Requires: gh CLI (GitHub CLI) to be installed and authenticated

set -e

# Default values
LIMIT=10
OUTPUT_FORMAT="text"
OUTPUT_FILE=""
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo ".")

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Parse arguments
NO_WAIT=false
WAIT_TIMEOUT=1800  # 30 minutes default timeout

while [[ $# -gt 0 ]]; do
    case $1 in
        --limit)
            LIMIT="$2"
            shift 2
            ;;
        --json)
            OUTPUT_FORMAT="json"
            shift
            ;;
        --output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        --no-wait)
            NO_WAIT=true
            shift
            ;;
        --timeout)
            WAIT_TIMEOUT="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [--limit N] [--json] [--output FILE] [--no-wait] [--timeout SECONDS]"
            echo ""
            echo "Options:"
            echo "  --limit N       Number of recent runs to check (default: 10)"
            echo "  --json          Output in JSON format"
            echo "  --output FILE   Write report to file instead of stdout"
            echo "  --no-wait       Don't wait for running jobs to complete"
            echo "  --timeout SECS  Max seconds to wait for running jobs (default: 1800)"
            echo "  --help          Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
    echo "Error: GitHub CLI (gh) is not installed or not in PATH"
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "Error: Not authenticated with GitHub CLI"
    echo "Run: gh auth login"
    exit 1
fi

# Function to print colored output (only in text mode)
print_header() {
    if [[ "$OUTPUT_FORMAT" == "text" ]]; then
        echo -e "\n${BOLD}${BLUE}$1${NC}"
        echo "$(printf '=%.0s' {1..60})"
    fi
}

print_error() {
    if [[ "$OUTPUT_FORMAT" == "text" ]]; then
        echo -e "${RED}✗ $1${NC}"
    fi
}

print_success() {
    if [[ "$OUTPUT_FORMAT" == "text" ]]; then
        echo -e "${GREEN}✓ $1${NC}"
    fi
}

print_warning() {
    if [[ "$OUTPUT_FORMAT" == "text" ]]; then
        echo -e "${YELLOW}⚠ $1${NC}"
    fi
}

print_info() {
    if [[ "$OUTPUT_FORMAT" == "text" ]]; then
        echo -e "${CYAN}ℹ $1${NC}"
    fi
}

# Check for running workflows and wait for them to complete
get_running_runs() {
    gh run list --limit "$LIMIT" --json databaseId,name,status,workflowName,headBranch,createdAt 2>/dev/null | \
    jq -c '[.[] | select(.status == "in_progress" or .status == "queued" or .status == "waiting" or .status == "pending")]'
}

wait_for_running_jobs() {
    if [[ "$NO_WAIT" == "true" ]]; then
        return 0
    fi
    
    local start_time=$(date +%s)
    local check_interval=15  # Check every 15 seconds
    local spinner=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
    local spin_idx=0
    
    while true; do
        local running_runs=$(get_running_runs)
        local running_count=$(echo "$running_runs" | jq 'length')
        
        if [[ "$running_count" -eq 0 ]]; then
            if [[ "$OUTPUT_FORMAT" == "text" ]]; then
                echo -e "\r${GREEN}✓ All workflows completed${NC}                                        "
            fi
            return 0
        fi
        
        # Check timeout
        local current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        if [[ $elapsed -ge $WAIT_TIMEOUT ]]; then
            if [[ "$OUTPUT_FORMAT" == "text" ]]; then
                echo -e "\n${YELLOW}⚠ Timeout reached after ${WAIT_TIMEOUT}s. Proceeding with inspection...${NC}"
            fi
            return 0
        fi
        
        # Display waiting message with spinner
        if [[ "$OUTPUT_FORMAT" == "text" ]]; then
            local remaining=$((WAIT_TIMEOUT - elapsed))
            local workflow_names=$(echo "$running_runs" | jq -r '.[].workflowName' | sort -u | tr '\n' ', ' | sed 's/,$//')
            echo -ne "\r${spinner[$spin_idx]} Waiting for $running_count running job(s): ${CYAN}$workflow_names${NC} (${remaining}s remaining)    "
            spin_idx=$(( (spin_idx + 1) % ${#spinner[@]} ))
        fi
        
        sleep $check_interval
    done
}

# Get failed runs
get_failed_runs() {
    gh run list --limit "$LIMIT" --json databaseId,name,status,conclusion,workflowName,headBranch,createdAt,updatedAt 2>/dev/null | \
    jq -c '[.[] | select(.conclusion == "failure" or .conclusion == "action_required")]'
}

# Get failed logs for a specific run
get_failed_logs() {
    local run_id=$1
    gh run view "$run_id" --log-failed 2>/dev/null || echo ""
}

# Extract error patterns from logs
extract_errors() {
    local logs="$1"
    local errors=()
    
    # Pattern: npm error Missing script
    if echo "$logs" | grep -q "Missing script"; then
        # macOS compatible: extract script name between quotes after "Missing script: "
        script_name=$(echo "$logs" | grep -o 'Missing script: "[^"]*"' | head -1 | sed 's/Missing script: "//;s/"$//')
        # Extract app name from parentheses like "(animation-demo)"
        app_name=$(echo "$logs" | grep -oE '\([a-zA-Z0-9_-]+\)' | head -1 | tr -d '()')
        errors+=("missing_script:$app_name:$script_name")
    fi
    
    # Pattern: Could not find file (glob pattern issue)
    if echo "$logs" | grep -q "Could not find"; then
        file_pattern=$(echo "$logs" | grep -o "Could not find '[^']*'" | head -1 | sed "s/Could not find '//;s/'$//")
        app_name=$(echo "$logs" | grep -oE '\([a-zA-Z0-9_-]+\)' | head -1 | tr -d '()')
        errors+=("glob_pattern:$app_name:$file_pattern")
    fi
    
    # Pattern: npm audit vulnerabilities
    if echo "$logs" | grep -q "vulnerabilities found"; then
        # Extract app name from "NPM Audit (app-name)"
        app_name=$(echo "$logs" | grep -o 'NPM Audit ([^)]*)' | head -1 | sed 's/NPM Audit (//;s/)$//')
        errors+=("npm_audit:$app_name:high_severity_vulnerabilities")
    fi
    
    # Pattern: Code scanning not enabled
    if echo "$logs" | grep -q "Code scanning is not enabled"; then
        errors+=("repo_setting:code_scanning:not_enabled")
    fi
    
    # Pattern: Test failures
    if echo "$logs" | grep -qE "(FAIL|failed|Error:.*test)"; then
        test_info=$(echo "$logs" | grep -oE '(FAIL|failing)[^$]*' | head -1 | cut -c1-80)
        errors+=("test_failure::$test_info")
    fi
    
    # Pattern: Build failures
    if echo "$logs" | grep -qE "(Build failed|compilation error|SyntaxError)"; then
        errors+=("build_failure::compilation_or_syntax_error")
    fi
    
    # Pattern: Dependency issues
    if echo "$logs" | grep -qE "(npm ERR!|Could not resolve dependency)"; then
        errors+=("dependency_error::npm_install_failed")
    fi
    
    # Pattern: Permission issues
    if echo "$logs" | grep -qE "(Permission denied|EACCES)"; then
        errors+=("permission_error::access_denied")
    fi
    
    # If no specific pattern matched but there's an error
    if [[ ${#errors[@]} -eq 0 ]] && echo "$logs" | grep -q "##\[error\]"; then
        generic_error=$(echo "$logs" | grep -o '##\[error\].*' | head -1 | sed 's/##\[error\]//')
        errors+=("generic_error::$generic_error")
    fi
    
    printf '%s\n' "${errors[@]}"
}

# Generate fix suggestions
suggest_fix() {
    local error_type=$1
    local component=$2
    local detail=$3
    
    case $error_type in
        "missing_script")
            echo "Add '$detail' script to $component/package.json"
            echo "  Example: \"$detail\": \"echo \\\"No tests\\\" && exit 0\""
            ;;
        "glob_pattern")
            echo "Fix glob pattern in $component/package.json"
            echo "  The pattern '$detail' is not expanding correctly"
            echo "  Use simpler patterns like 'test/unit/*.test.js' instead of '**/*.test.js'"
            ;;
        "npm_audit")
            echo "Fix security vulnerabilities in $component"
            echo "  Run: cd $component && npm audit fix"
            echo "  Or update the workflow to handle audit results properly"
            ;;
        "repo_setting")
            echo "Enable $component in repository settings"
            echo "  Go to: Settings → Security → Code scanning"
            ;;
        "test_failure")
            echo "Fix failing tests"
            echo "  Run tests locally: npm test"
            echo "  Check test output for specific failures"
            ;;
        "build_failure")
            echo "Fix build/compilation errors"
            echo "  Check syntax and imports"
            echo "  Run: npm run build (if available)"
            ;;
        "dependency_error")
            echo "Fix dependency installation issues"
            echo "  Run: npm install"
            echo "  Check package.json for invalid dependencies"
            ;;
        "permission_error")
            echo "Fix file permission issues"
            echo "  Check file permissions and ownership"
            ;;
        *)
            echo "Review the error logs for details"
            ;;
    esac
}

# Main report generation
generate_report() {
    local failed_runs
    failed_runs=$(get_failed_runs)
    
    local run_count
    run_count=$(echo "$failed_runs" | jq 'length')
    
    if [[ "$OUTPUT_FORMAT" == "json" ]]; then
        # JSON output
        local json_report='{"generated_at":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","failed_runs":[],"summary":{"total_failures":0,"error_types":{}}}'
        local all_errors=()
        
        while IFS= read -r run; do
            local run_id=$(echo "$run" | jq -r '.databaseId')
            local workflow_name=$(echo "$run" | jq -r '.workflowName')
            local branch=$(echo "$run" | jq -r '.headBranch')
            local conclusion=$(echo "$run" | jq -r '.conclusion')
            local created_at=$(echo "$run" | jq -r '.createdAt')
            
            local logs=$(get_failed_logs "$run_id")
            local errors=$(extract_errors "$logs")
            
            local run_entry='{"run_id":'$run_id',"workflow":"'"$workflow_name"'","branch":"'"$branch"'","conclusion":"'"$conclusion"'","created_at":"'"$created_at"'","errors":[],"suggestions":[]}'
            
            while IFS= read -r error_line; do
                [[ -z "$error_line" ]] && continue
                IFS=':' read -r error_type component detail <<< "$error_line"
                local suggestion=$(suggest_fix "$error_type" "$component" "$detail" | tr '\n' ' ')
                run_entry=$(echo "$run_entry" | jq --arg et "$error_type" --arg c "$component" --arg d "$detail" --arg s "$suggestion" \
                    '.errors += [{"type":$et,"component":$c,"detail":$d}] | .suggestions += [$s]')
                all_errors+=("$error_type")
            done <<< "$errors"
            
            json_report=$(echo "$json_report" | jq --argjson re "$run_entry" '.failed_runs += [$re]')
        done < <(echo "$failed_runs" | jq -c '.[]')
        
        # Add summary
        json_report=$(echo "$json_report" | jq --arg count "$run_count" '.summary.total_failures = ($count | tonumber)')
        
        echo "$json_report" | jq '.'
    else
        # Text output
        print_header "GitHub Actions CI Failure Report"
        echo -e "Generated: $(date)"
        echo -e "Repository: $(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo 'Unknown')"
        echo ""
        
        if [[ "$run_count" -eq 0 ]]; then
            print_success "No failed runs found in the last $LIMIT runs!"
            return 0
        fi
        
        print_warning "Found $run_count failed/action-required runs"
        echo ""
        
        local error_summary=()
        local run_num=1
        
        while IFS= read -r run; do
            local run_id=$(echo "$run" | jq -r '.databaseId')
            local workflow_name=$(echo "$run" | jq -r '.workflowName')
            local branch=$(echo "$run" | jq -r '.headBranch')
            local conclusion=$(echo "$run" | jq -r '.conclusion')
            local created_at=$(echo "$run" | jq -r '.createdAt')
            
            print_header "[$run_num] $workflow_name"
            echo -e "  ${BOLD}Run ID:${NC}     $run_id"
            echo -e "  ${BOLD}Branch:${NC}     $branch"
            echo -e "  ${BOLD}Status:${NC}     $conclusion"
            echo -e "  ${BOLD}Created:${NC}    $created_at"
            echo ""
            
            echo -e "  ${BOLD}Fetching logs...${NC}"
            local logs=$(get_failed_logs "$run_id")
            
            if [[ -z "$logs" ]]; then
                print_warning "  No failed logs available"
            else
                echo -e "  ${BOLD}${RED}Errors Found:${NC}"
                local errors=$(extract_errors "$logs")
                
                if [[ -z "$errors" ]]; then
                    echo -e "    ${YELLOW}Could not extract specific errors. Raw log snippet:${NC}"
                    echo "$logs" | grep -E "(error|Error|ERROR|fail|Fail|FAIL)" | head -5 | sed 's/^/      /'
                else
                    while IFS= read -r error_line; do
                        [[ -z "$error_line" ]] && continue
                        IFS=':' read -r error_type component detail <<< "$error_line"
                        echo ""
                        echo -e "    ${RED}• Type:${NC} $error_type"
                        [[ -n "$component" ]] && echo -e "    ${RED}  Component:${NC} $component"
                        [[ -n "$detail" ]] && echo -e "    ${RED}  Detail:${NC} $detail"
                        echo ""
                        echo -e "    ${GREEN}Suggested Fix:${NC}"
                        suggest_fix "$error_type" "$component" "$detail" | sed 's/^/      /'
                        error_summary+=("$error_type")
                    done <<< "$errors"
                fi
            fi
            
            echo ""
            ((run_num++))
        done < <(echo "$failed_runs" | jq -c '.[]')
        
        # Print summary
        print_header "Summary"
        echo -e "Total failed runs: $run_count"
        echo ""
        
        if [[ ${#error_summary[@]} -gt 0 ]]; then
            echo -e "${BOLD}Error Types:${NC}"
            printf '%s\n' "${error_summary[@]}" | sort | uniq -c | sort -rn | while read count type; do
                echo "  - $type: $count occurrence(s)"
            done
        fi
        
        echo ""
        print_header "Quick Commands"
        echo "  View run in browser:    gh run view <RUN_ID> --web"
        echo "  Re-run failed jobs:     gh run rerun <RUN_ID> --failed"
        echo "  View full logs:         gh run view <RUN_ID> --log"
        echo ""
    fi
}

# Main execution
main() {
    # First, wait for any running jobs to complete
    if [[ "$OUTPUT_FORMAT" == "text" ]]; then
        print_header "Checking for Running Workflows"
        local running=$(get_running_runs)
        local running_count=$(echo "$running" | jq 'length')
        
        if [[ "$running_count" -gt 0 ]]; then
            print_info "Found $running_count running workflow(s)"
            wait_for_running_jobs
            echo ""
        else
            print_success "No running workflows found"
        fi
    else
        # JSON mode - still wait but silently
        wait_for_running_jobs
    fi
    
    # Now generate the report
    generate_report
}

# Run the script
if [[ -n "$OUTPUT_FILE" ]]; then
    main > "$OUTPUT_FILE"
    echo "Report written to: $OUTPUT_FILE"
else
    main
fi
