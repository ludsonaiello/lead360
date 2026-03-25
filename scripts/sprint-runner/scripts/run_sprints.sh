#!/usr/bin/env bash
# =============================================================================
# sprint-runner.sh — Automated Claude Code Sprint Runner
# Usage examples at bottom of file
# =============================================================================

set -euo pipefail

# ─── CONFIG ──────────────────────────────────────────────────────────────────
PROJECT_ROOT="${PROJECT_ROOT:-/var/www/lead360.app}"
SPRINTS_BASE="${PROJECT_ROOT}/documentation/sprints"
LOG_DIR="${PROJECT_ROOT}/scripts/logs"
CLAUDE_BIN="${CLAUDE_BIN:-/root/.nvm/versions/node/v22.11.0/bin/claude}"

# Slash commands
BACKEND_CMD="/backenddev"
FRONTEND_CMD="/frontenddev"
DOC_CMD="/documentation"

# Keywords in filename or folder that flag a sprint as documentation type
DOC_KEYWORDS=("doc" "documentation" "docs" "readme" "spec" "api-doc")
FRONTEND_KEYWORDS=("frontend" "ui" "ux" "react" "angular" "vue" "svelte")

# Backend dev prompt (heredoc, easy to edit)
read -r -d '' BACKEND_PROMPT << 'PROMPT_EOF' || true
I'll give you a sprint to follow. You are an expert backend developer that makes Google, Amazon and Apple developers jealous. Go beyond the quality and tell me if you find some gap or error. Pay attention, do not make mistakes, do not rush, validate every code you write.
Your sprint: @documentation/sprints/SPRINT_PATH
PROMPT_EOF

# Frontend dev prompt (heredoc, easy to edit)
read -r -d '' FRONTEND_PROMPT << 'PROMPT_EOF' || true
I'll give you a sprint to follow. You are an expert frontend developer that makes Google, Amazon and Apple developers jealous. Go beyond the quality and tell me if you find some gap or error. Pay attention, do not make mistakes, do not rush, validate every code you write.
Your sprint: @documentation/sprints/SPRINT_PATH
PROMPT_EOF

# Doc sprint prompt
read -r -d '' DOC_PROMPT << 'PROMPT_EOF' || true
I'll give you a sprint to follow. You are an expert technical writer and documentation engineer. Produce clear, accurate, and complete documentation. Check for gaps, inconsistencies, and missing details.
Your sprint: @documentation/sprints/SPRINT_PATH
PROMPT_EOF

# ─── HELPERS ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()     { echo -e "${CYAN}[RUNNER]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# Detect if a sprint is documentation type based on folder name or file name
is_doc_sprint() {
  local path="$1"
  local lower
  lower=$(echo "$path" | tr '[:upper:]' '[:lower:]')
  for kw in "${DOC_KEYWORDS[@]}"; do
    if [[ "$lower" == *"$kw"* ]]; then
      return 0
    fi
  done
  return 1
}

is_frontend_sprint() {
  local path="$1"
  local lower
  lower=$(echo "$path" | tr '[:upper:]' '[:lower:]')
  for kw in "${FRONTEND_KEYWORDS[@]}"; do
    if [[ "$lower" == *"$kw"* ]]; then
      return 0
    fi
  done
  return 1
}

# Build the full path to a sprint file
# Args: folder (e.g. f04) sprint_number (e.g. 3)
# Returns path relative to SPRINTS_BASE
resolve_sprint_file() {
  local folder="$1"
  local number="$2"
  local category="${3:-financial}"   # financial | other categories

  # Normalize folder: accept f04, 04, 4 → always f04 style
  local fnum
  fnum=$(echo "$folder" | sed 's/^f//I' | sed 's/^0*//')
  local fpad
  fpad=$(printf "%02d" "$fnum")
  local fname="f${fpad}"

  local sprint_dir="${SPRINTS_BASE}/${category}/${fname}"

  # Find matching file: sprint_f04_3.md or sprint_4_3.md etc.
  local found
  found=$(find "$sprint_dir" -maxdepth 1 -name "sprint_*_${number}.md" 2>/dev/null | sort | head -1)

  if [[ -z "$found" ]]; then
    error "Sprint file not found: folder=$fname number=$number (looked in $sprint_dir)"
    return 1
  fi

  # Return relative path from PROJECT_ROOT
  echo "${found#${PROJECT_ROOT}/}"
}

# Run a single sprint through Claude Code
run_sprint() {
  local rel_path="$1"
  local abs_path="${PROJECT_ROOT}/${rel_path}"

  if [[ ! -f "$abs_path" ]]; then
    error "Sprint file does not exist: $abs_path"
    return 1
  fi

  # Choose prompt type
  local prompt slash_cmd
  if is_doc_sprint "$rel_path"; then
    log "📄 Documentation sprint detected: $rel_path"
    slash_cmd="$DOC_CMD"
    prompt="${DOC_PROMPT/SPRINT_PATH/$rel_path}"
  elif is_frontend_sprint "$rel_path"; then
    log "🎨 Frontend sprint detected: $rel_path"
    slash_cmd="$FRONTEND_CMD"
    prompt="${FRONTEND_PROMPT/SPRINT_PATH/$rel_path}"
  else
    log "⚙️  Backend sprint detected: $rel_path"
    slash_cmd="$BACKEND_CMD"
    prompt="${BACKEND_PROMPT/SPRINT_PATH/$rel_path}"
  fi

  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  log "Running sprint: $rel_path"
  log "Slash command:  $slash_cmd"
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Timestamp for log
  local ts
  ts=$(date +"%Y%m%d_%H%M%S")
  mkdir -p "$LOG_DIR"
  local logfile="${LOG_DIR}/${ts}_$(basename "$rel_path" .md).log"

  # ── Run the sprint ──────────────────────────────────────────────────────────
  # Claude Code accepts: claude --print --no-markdown -p "PROMPT"
  # We pipe the slash command + prompt together
  local full_prompt="${slash_cmd}
${prompt}"

  log "Starting Claude Code... (log: $logfile)"

  (
    cd "$PROJECT_ROOT"
    "$CLAUDE_BIN" \
      --allowedTools "bash,read_file,write_file,edit_file,list_directory" \
      --print \
      -p "$full_prompt" \
      2>&1 | tee "$logfile"
  )

  local exit_code=${PIPESTATUS[0]}

  if [[ $exit_code -ne 0 ]]; then
    error "Sprint failed with exit code $exit_code — check $logfile"
    return 1
  fi

  # ── Run the review ──────────────────────────────────────────────────────────
  log ""
  log "🔍 Running deep review for: $rel_path"
  log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  local review_logfile="${LOG_DIR}/${ts}_$(basename "$rel_path" .md)_review.log"

  (
    cd "$PROJECT_ROOT"
    "$CLAUDE_BIN" \
      --allowedTools "bash,read_file,write_file,edit_file,list_directory" \
      --print \
      -p "$REVIEW_PROMPT" \
      2>&1 | tee "$review_logfile"
  )

  success "Sprint complete: $rel_path"
  log ""
}

# ─── SPRINT RANGE PARSER ─────────────────────────────────────────────────────
# Collect all sprint files matching a folder, sorted numerically
get_sprints_in_folder() {
  local folder="$1"
  local category="${2:-financial}"
  local fnum
  fnum=$(echo "$folder" | sed 's/^f//I' | sed 's/^0*//')
  local fpad
  fpad=$(printf "%02d" "$fnum")
  local sprint_dir="${SPRINTS_BASE}/${category}/f${fpad}"

  if [[ ! -d "$sprint_dir" ]]; then
    error "Sprint folder not found: $sprint_dir"
    return 1
  fi

  # Return relative paths sorted by sprint number
  find "$sprint_dir" -maxdepth 1 -name "sprint_*.md" 2>/dev/null \
    | sort -t_ -k3 -n \
    | while read -r f; do echo "${f#${PROJECT_ROOT}/}"; done
}

# Extract sprint number from filename (sprint_f04_7.md → 7)
sprint_number_from_path() {
  local path="$1"
  basename "$path" .md | rev | cut -d_ -f1 | rev | sed 's/^0*//'
}

# Extract folder from path (financial/f04/sprint_f04_7.md → f04)
sprint_folder_from_path() {
  local path="$1"
  basename "$(dirname "$path")"
}

# ─── MAIN ENTRY POINTS ───────────────────────────────────────────────────────

# Run a single sprint by explicit path segment: financial/f04 sprint 7
cmd_run_one() {
  local folder="$1"; local number="$2"; local category="${3:-financial}"
  local rel_path
  rel_path=$(resolve_sprint_file "$folder" "$number" "$category")
  run_sprint "$rel_path"
}

# Run all sprints in one or more folders in order
cmd_run_folders() {
  local category="${1:-financial}"; shift
  local folders=("$@")
  for folder in "${folders[@]}"; do
    log "📂 Processing folder: $folder"
    while IFS= read -r sprint_path; do
      run_sprint "$sprint_path"
    done < <(get_sprints_in_folder "$folder" "$category")
  done
}

# Run a range: start folder+number → end folder+number
# e.g. start_folder=f04 start_num=6 end_folder=f05 end_num=99 (all of f05)
cmd_run_range() {
  local start_folder="$1"
  local start_num="$2"
  local end_folder="${3:-$start_folder}"
  local end_num="${4:-9999}"
  local category="${5:-financial}"

  # Build sorted list of folders between start and end
  local start_fnum end_fnum
  start_fnum=$(echo "$start_folder" | sed 's/^f//I' | sed 's/^0*//')
  end_fnum=$(echo "$end_folder"   | sed 's/^f//I' | sed 's/^0*//')

  for (( fi=start_fnum; fi<=end_fnum; fi++ )); do
    local fpad
    fpad=$(printf "%02d" "$fi")
    local folder="f${fpad}"
    local sprint_dir="${SPRINTS_BASE}/${category}/${folder}"
    [[ -d "$sprint_dir" ]] || continue

    while IFS= read -r sprint_path; do
      local snum
      snum=$(sprint_number_from_path "$sprint_path")
      # Skip if before start range (only applies to first folder)
      [[ $fi -eq $start_fnum && $snum -lt $start_num ]] && continue
      # Skip if after end range (only applies to last folder)
      [[ $fi -eq $end_fnum   && $snum -gt $end_num   ]] && continue
      run_sprint "$sprint_path"
    done < <(get_sprints_in_folder "$folder" "$category")
  done
}

# ─── CLI INTERFACE ────────────────────────────────────────────────────────────
usage() {
  cat << 'EOF'
sprint-runner.sh — Automate Claude Code sprints

USAGE:
  ./sprint-runner.sh <command> [options]

COMMANDS:
  one   <folder> <number> [category]
        Run a single sprint.
        Example: ./sprint-runner.sh one f04 9
        Example: ./sprint-runner.sh one 4 9 financial

  folders <category> <folder> [folder2 ...]
        Run all sprints in one or more folders in order.
        Example: ./sprint-runner.sh folders financial f04 f05
        Example: ./sprint-runner.sh folders financial f08

  range <start_folder> <start_num> [end_folder] [end_num] [category]
        Run sprints from start to end (inclusive).
        Example: ./sprint-runner.sh range f04 6              → f04 sprint 6 to end of f04
        Example: ./sprint-runner.sh range f04 6 f05          → f04#6 through all of f05
        Example: ./sprint-runner.sh range f04 7 f04 9        → f04 sprints 7, 8, 9
        Example: ./sprint-runner.sh range f04 6 f08 99 financial

  list  <folder> [category]
        List all sprint files in a folder without running them.
        Example: ./sprint-runner.sh list f04

ENVIRONMENT VARIABLES:
  PROJECT_ROOT   default: /var/www/lead360.app
  CLAUDE_BIN     default: claude
  
EOF
}

main() {
  if [[ $# -eq 0 ]]; then
    usage; exit 0
  fi

  local cmd="$1"; shift

  case "$cmd" in
    one)
      [[ $# -lt 2 ]] && { error "Usage: one <folder> <number> [category]"; exit 1; }
      cmd_run_one "$1" "$2" "${3:-financial}"
      ;;
    folders)
      [[ $# -lt 2 ]] && { error "Usage: folders <category> <folder> [folder2 ...]"; exit 1; }
      local cat="$1"; shift
      cmd_run_folders "$cat" "$@"
      ;;
    range)
      [[ $# -lt 2 ]] && { error "Usage: range <start_folder> <start_num> [end_folder] [end_num] [category]"; exit 1; }
      cmd_run_range "$@"
      ;;
    list)
      [[ $# -lt 1 ]] && { error "Usage: list <folder> [category]"; exit 1; }
      get_sprints_in_folder "$1" "${2:-financial}"
      ;;
    help|--help|-h)
      usage
      ;;
    *)
      error "Unknown command: $cmd"
      usage
      exit 1
      ;;
  esac
}

main "$@"