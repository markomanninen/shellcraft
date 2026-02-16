#!/bin/bash
#
# Merge Dependabot PRs
# Finds all open Dependabot PRs with passing CI and merges them
#
# Usage:
#   ./scripts/merge-dependabot-prs.sh [options]
#
# Options:
#   --dry-run    Show what would be merged without actually merging
#   --no-delete  Don't delete branches after merging
#   --help       Show this help message

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Options
DRY_RUN=false
DELETE_BRANCH=true

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --no-delete)
            DELETE_BRANCH=false
            shift
            ;;
        --help)
            head -20 "$0" | tail -15
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo ""
echo -e "${BLUE}Dependabot PR Merger${NC}"
echo "============================================================"

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) is not installed${NC}"
    echo "Install it: brew install gh"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${RED}Error: Not authenticated with GitHub CLI${NC}"
    echo "Run: gh auth login"
    exit 1
fi

# Get repo from git remote
REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null || echo "")
if [[ -z "$REPO" ]]; then
    echo -e "${RED}Error: Could not determine repository${NC}"
    echo "Make sure you're in a git repository with a GitHub remote"
    exit 1
fi

echo -e "Repository: ${GREEN}$REPO${NC}"
echo ""

if $DRY_RUN; then
    echo -e "${YELLOW}DRY RUN MODE - No changes will be made${NC}"
    echo ""
fi

# Find Dependabot PRs
echo "Finding Dependabot PRs..."
DEPENDABOT_PRS=$(gh pr list --repo "$REPO" --author "app/dependabot" --json number,title,headRefName,statusCheckRollup --jq '.[] | @base64')

if [[ -z "$DEPENDABOT_PRS" ]]; then
    echo -e "${GREEN}No open Dependabot PRs found${NC}"
    exit 0
fi

# Count PRs
TOTAL=$(echo "$DEPENDABOT_PRS" | wc -l | tr -d ' ')
echo -e "Found ${BLUE}$TOTAL${NC} Dependabot PR(s)"
echo ""

MERGED=0
SKIPPED=0
FAILED=0

# Function to get CI status display
get_ci_display() {
    case $1 in
        success) echo "${GREEN}✓ passed${NC}" ;;
        failure) echo "${RED}✗ failed${NC}" ;;
        pending) echo "${YELLOW}⋯ pending${NC}" ;;
        none)    echo "${YELLOW}○ no checks${NC}" ;;
        *)       echo "${YELLOW}? unknown${NC}" ;;
    esac
}

# Process each PR
for ROW in $DEPENDABOT_PRS; do
    # Decode base64
    PR_JSON=$(echo "$ROW" | base64 --decode)
    
    PR_NUM=$(echo "$PR_JSON" | jq -r '.number')
    PR_TITLE=$(echo "$PR_JSON" | jq -r '.title')
    PR_BRANCH=$(echo "$PR_JSON" | jq -r '.headRefName')
    
    # Check CI status
    CI_STATUS=$(echo "$PR_JSON" | jq -r '.statusCheckRollup | if . == null or . == [] then "none" elif all(.conclusion == "SUCCESS" or .conclusion == "NEUTRAL" or .conclusion == "SKIPPED") then "success" elif any(.conclusion == "FAILURE") then "failure" elif any(.state == "PENDING" or .state == "IN_PROGRESS") then "pending" else "unknown" end')
    
    CI_DISPLAY=$(get_ci_display "$CI_STATUS")
    
    echo "------------------------------------------------------------"
    echo -e "PR #${BLUE}$PR_NUM${NC}: $PR_TITLE"
    echo -e "   Branch: $PR_BRANCH"
    echo -e "   CI Status: $CI_DISPLAY"
    
    # Decide whether to merge
    if [[ "$CI_STATUS" == "success" || "$CI_STATUS" == "none" ]]; then
        if $DRY_RUN; then
            echo -e "   ${YELLOW}Would merge this PR${NC}"
            ((MERGED++))
        else
            echo -n "   Merging... "
            
            MERGE_ARGS="--squash"
            if $DELETE_BRANCH; then
                MERGE_ARGS="$MERGE_ARGS --delete-branch"
            fi
            
            if gh pr merge "$PR_NUM" --repo "$REPO" $MERGE_ARGS 2>/dev/null; then
                echo -e "${GREEN}✓ Merged${NC}"
                ((MERGED++))
                # Small delay to avoid rate limiting
                sleep 1
            else
                echo -e "${RED}✗ Failed${NC}"
                ((FAILED++))
            fi
        fi
    elif [[ "$CI_STATUS" == "pending" ]]; then
        echo -e "   ${YELLOW}Skipped (CI still running)${NC}"
        ((SKIPPED++))
    else
        echo -e "   ${YELLOW}Skipped (CI not passing)${NC}"
        ((SKIPPED++))
    fi
done

echo ""
echo "============================================================"
echo -e "${BLUE}Summary${NC}"
echo "------------------------------------------------------------"
if $DRY_RUN; then
    echo -e "  Would merge: ${GREEN}$MERGED${NC}"
else
    echo -e "  Merged:  ${GREEN}$MERGED${NC}"
fi
echo -e "  Skipped: ${YELLOW}$SKIPPED${NC}"
if [[ $FAILED -gt 0 ]]; then
    echo -e "  Failed:  ${RED}$FAILED${NC}"
fi
echo ""

# Pull changes if we merged anything
if [[ $MERGED -gt 0 ]] && ! $DRY_RUN; then
    echo "Pulling latest changes..."
    git pull --rebase 2>/dev/null || echo -e "${YELLOW}Could not pull (you may need to pull manually)${NC}"
fi
