#!/bin/bash
# Sprint Runner Pipeline
# Executes sprint files sequentially through Claude Code with auto-approved tools,
# performs deep review after each folder, then clears context for the next folder.
#
# Usage:
#   ./run_sprints.sh <sprints_base_path> [folder1 folder2 ...]
#
# Examples:
#   ./run_sprints.sh ./documentation/sprints/financial/           # Run all folders
#   ./run_sprints.sh ./documentation/sprints/financial/ f04 f05   # Run specific folders
#   ./run_sprints.sh ./documentation/sprints/financial/ f07       # Run single folder

set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────────────
SPRINTS_BASE="${1:?Usage: $0 <sprints_base_path> [folder1 folder2 ...]}"
shift
SPECIFIC_FOLDERS=("$@")

LOG_DIR="./sprint-logs/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$LOG_DIR"

# Tools that Claude Code is allowed to use without asking
ALLOWED_TOOLS=(
  "Bash(find:*)" "Bash(ls:*)" "Bash(mysql:*)" "Bash(kill:*)"
  "Bash(fuser:*)" "Bash(lsof:*)" "Bash(npm:*)" "Bash(node:*)"
  "Bash(python:*)" "Bash(pip:*)" "Bash(git:*)" "Bash(curl:*)"
  "Bash(cat:*)" "Bash(grep:*)" "Bash(sed:*)" "Bash(awk:*)"
  "Bash(mkdir:*)" "Bash(cp:*)" "Bash(mv:*)" "Bash(rm:*)"
  "Bash(chmod:*)" "Bash(cd:*)" "Bash(echo:*)" "Bash(tar:*)"
  "Bash(tail:*)" "Bash(head:*)" "Bash(sort:*)" "Bash(wc:*)"
  "Bash(diff:*)" "Bash(docker:*)" "Bash(wget:*)" "Bash(zip:*)"
  "Bash(unzip:*)" "Bash(service:*)" "Bash(systemctl:*)"
  "Edit" "Write" "Read"
)

# Build the --allowedTools flag string
TOOLS_FLAG=""
for tool in "${ALLOWED_TOOLS[@]}"; do
  TOOLS_FLAG="$TOOLS_FLAG --allowedTools \"$tool\""
done

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ─── Helper Functions ────────────────────────────────────────────────────────

log() {
  local level="$1"
  shift
  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo -e "${timestamp} [${level}] $*" | tee -a "$LOG_DIR/pipeline.log"
}

info()    { log "${BLUE}INFO${NC}" "$@"; }
success() { log "${GREEN}DONE${NC}" "$@"; }
warn()    { log "${YELLOW}WARN${NC}" "$@"; }
error()   { log "${RED}FAIL${NC}" "$@"; }

run_claude() {
  local prompt="$1"
  local log_file="$2"

  info "Running Claude Code..."

  # Build command with eval to handle quoted tool names
  eval claude -p \""$prompt"\" \
    $TOOLS_FLAG \
    --output-format json \
    > "$log_file" 2>&1

  local exit_code=$?

  if [ $exit_code -ne 0 ]; then
    error "Claude exited with code $exit_code. Check $log_file"
    return $exit_code
  fi

  return 0
}

kill_ports() {
  info "Cleaning up ports 8000 and 7000..."
  lsof -ti:8000 | xargs kill -9 2>/dev/null || true
  lsof -ti:7000 | xargs kill -9 2>/dev/null || true
  fuser -k 8000/tcp 2>/dev/null || true
  fuser -k 7000/tcp 2>/dev/null || true
}

# ─── Discover Folders ────────────────────────────────────────────────────────

if [ ${#SPECIFIC_FOLDERS[@]} -gt 0 ]; then
  FOLDERS=("${SPECIFIC_FOLDERS[@]}")
else
  FOLDERS=()
  for dir in "$SPRINTS_BASE"/f*/; do
    [ -d "$dir" ] && FOLDERS+=("$(basename "$dir")")
  done
fi

if [ ${#FOLDERS[@]} -eq 0 ]; then
  error "No sprint folders found in $SPRINTS_BASE"
  exit 1
fi

# Sort folders naturally
IFS=$'\n' FOLDERS=($(sort -V <<< "${FOLDERS[*]}")); unset IFS

TOTAL_SPRINTS=0
for folder in "${FOLDERS[@]}"; do
  count=$(ls "$SPRINTS_BASE/$folder"/sprint_*.md 2>/dev/null | wc -l)
  TOTAL_SPRINTS=$((TOTAL_SPRINTS + count))
done

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Sprint Runner Pipeline${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "  Folders:  ${#FOLDERS[@]} (${FOLDERS[0]} → ${FOLDERS[-1]})"
echo -e "  Sprints:  $TOTAL_SPRINTS total"
echo -e "  Logs:     $LOG_DIR/"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# ─── Main Pipeline ───────────────────────────────────────────────────────────

COMPLETED=0
FAILED=0
START_TIME=$(date +%s)

for folder in "${FOLDERS[@]}"; do
  FOLDER_PATH="$SPRINTS_BASE/$folder"
  FOLDER_LOG_DIR="$LOG_DIR/$folder"
  mkdir -p "$FOLDER_LOG_DIR"

  echo ""
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}  Starting folder: $folder${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  # Read index.md for context
  INDEX_CONTENT=""
  if [ -f "$FOLDER_PATH/index.md" ]; then
    INDEX_CONTENT=$(cat "$FOLDER_PATH/index.md")
    info "Read index.md for $folder"
  fi

  # Get sorted sprint files
  SPRINT_FILES=($(ls "$FOLDER_PATH"/sprint_*.md 2>/dev/null | sort -V))

  if [ ${#SPRINT_FILES[@]} -eq 0 ]; then
    warn "No sprint files in $folder, skipping"
    continue
  fi

  info "Found ${#SPRINT_FILES[@]} sprints in $folder"

  # ─── Execute each sprint ─────────────────────────────────────────────────

  FOLDER_SPRINT_NUM=0
  for sprint_file in "${SPRINT_FILES[@]}"; do
    FOLDER_SPRINT_NUM=$((FOLDER_SPRINT_NUM + 1))
    SPRINT_NAME=$(basename "$sprint_file" .md)

    echo ""
    info "[$folder] Sprint $FOLDER_SPRINT_NUM/${#SPRINT_FILES[@]}: $SPRINT_NAME"

    # Read sprint content
    SPRINT_CONTENT=$(cat "$sprint_file")

    # Build the prompt
    PROMPT="You are executing a coding sprint. Follow the instructions precisely.

## Context (from index.md for this module):
$INDEX_CONTENT

## Sprint Instructions ($SPRINT_NAME):
$SPRINT_CONTENT

## Rules:
- Execute ALL instructions in the sprint file completely
- If you need to run MySQL commands, run them directly
- If you need to start/stop servers, do it (kill ports 8000/7000 first if needed)
- No placeholder code, no TODOs, no mock implementations
- No hardcoded URLs that should be environment variables
- Test your work before finishing
- If something fails, debug and fix it — do not skip

After completing all tasks, do a quick sanity check:
1. Re-read the sprint requirements
2. Verify each requirement is implemented
3. Make sure the code runs without errors"

    # Run the sprint
    if run_claude "$PROMPT" "$FOLDER_LOG_DIR/${SPRINT_NAME}.json"; then
      success "[$folder] $SPRINT_NAME completed"
      COMPLETED=$((COMPLETED + 1))
    else
      error "[$folder] $SPRINT_NAME FAILED"
      FAILED=$((FAILED + 1))
      # Continue to next sprint — don't block the whole pipeline
      # The review pass will catch issues
    fi

    # Small pause between sprints to avoid rate limiting
    sleep 2
  done

  # ─── Deep Review Pass (runs twice) ──────────────────────────────────────

  echo ""
  echo -e "${CYAN}  Starting deep review for $folder...${NC}"

  # Collect all sprint file names for review context
  SPRINT_LIST=""
  for sf in "${SPRINT_FILES[@]}"; do
    SPRINT_LIST="$SPRINT_LIST\n- $(basename "$sf")"
  done

  REVIEW_PROMPT="You just completed all sprints for the $folder module. Now perform a DEEP review.

## Module context (index.md):
$INDEX_CONTENT

## Sprints completed:
$(echo -e "$SPRINT_LIST")

## Review Protocol — DO THIS TWICE:

Review your job deeply, every single sprint. Check for:

1. LOGIC ERRORS — does the code actually do what the sprint asked? Trace through the logic. Check edge cases.
2. TYPE ERRORS — wrong types, missing annotations, implicit coercion bugs
3. RUNTIME ERRORS — null/undefined access, missing imports, unhandled exceptions, race conditions
4. CODE QUALITY:
   - No TODO comments left behind
   - No mock/placeholder code anywhere
   - No hardcoded URLs that shouldn't be there (dev URLs in prod, localhost in config)
   - No commented-out code blocks
   - No debug print/console.log statements
   - Proper error handling everywhere
   - Consistent naming conventions
5. COMPLETENESS — re-read EVERY sprint file. For each requirement, verify it was actually implemented.
6. LINE BY LINE — read through every file you changed. Look for typos, off-by-one errors, missing edge cases.

Do this review TWICE. First pass catches the obvious stuff. Second pass catches what you missed.

If you find ANY issues, fix them immediately. Do not just report them — fix them.

After both review passes, output a summary:
\`\`\`
## Review Complete: $folder
- Files reviewed: [list]
- Issues found and fixed: [list with details, or 'None']
- Confidence level: [High/Medium/Low]
- Notes: [anything important]
\`\`\`

Remember: if you say it's all done and there's a single error — that's unacceptable. Be thorough."

  if run_claude "$REVIEW_PROMPT" "$FOLDER_LOG_DIR/review.json"; then
    success "[$folder] Review completed"
  else
    error "[$folder] Review FAILED — manual review recommended"
  fi

  # Clean up ports between folders
  kill_ports

  echo -e "${GREEN}  ✓ Folder $folder complete${NC}"
done

# ─── Final Summary ───────────────────────────────────────────────────────────

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Pipeline Complete${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "  Completed: ${GREEN}$COMPLETED${NC}"
echo -e "  Failed:    ${RED}$FAILED${NC}"
echo -e "  Duration:  ${MINUTES}m ${SECONDS}s"
echo -e "  Logs:      $LOG_DIR/"
echo -e "${CYAN}═══════════════════════════════════════════════════════════════${NC}"

# Exit with error if any sprints failed
[ $FAILED -eq 0 ] || exit 1
