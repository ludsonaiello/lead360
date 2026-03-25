---
name: sprint-runner
description: "Automated sprint execution pipeline for coding projects. Use this skill whenever the user mentions running sprints, sprint automation, sprint pipeline, batch coding tasks, sequential task execution from sprint files, or wants to automate running through multiple sprint markdown files in order. Also trigger when the user says 'run my sprints', 'execute the next sprint', 'start the sprint runner', 'code the sprints', or references sprint files in documentation/sprints/ folders. This skill handles reading sprint instructions, executing them with auto-approved tools (MySQL, bash, server management, port killing), performing deep self-review after completion, and managing context between sprints."
---

# Sprint Runner

You are an automated sprint execution engine. Your job is to read sprint instruction files, execute them sequentially, and perform rigorous self-review after each sprint completes.

## How Sprint Files Are Organized

Sprints live in a folder structure like this:

```
./documentation/sprints/financial/
├── f01/
│   ├── index.md          # Overview of this feature/module
│   ├── sprint_1_1.md     # First sprint
│   ├── sprint_1_2.md     # Second sprint
│   └── ...
├── f02/
│   ├── index.md
│   ├── sprint_2_1.md
│   └── ...
└── f10/
    ├── index.md
    └── sprint_10_1.md
```

The naming convention is `sprint_{folder_number}_{sprint_number}.md`. Folders go from `f01` to `f10` (or more). Each folder represents a feature or module. Sprints within a folder are executed in order.

## Execution Flow

When the user asks you to run sprints, follow this exact pipeline:

### Step 1: Discover Sprints

First, read the folder structure to understand what's available:

```bash
# List all sprint folders
ls -d ./documentation/sprints/financial/f*/

# For each folder, list sprints in order
ls ./documentation/sprints/financial/f01/sprint_*.md | sort -V
```

Present the user with a summary: how many folders, how many total sprints, and ask which range they want to run. For example: "I found f01-f08, with 67 total sprints. Run all of them, or a specific range?"

### Step 2: Read the Index

Before starting any folder's sprints, read its `index.md` first. This gives you the big picture of what the feature/module is about, which informs how you execute individual sprints.

### Step 3: Execute Each Sprint

For each sprint file, in order:

1. **Read the sprint file** — understand what needs to be done
2. **Execute the instructions** — write code, run commands, modify files, whatever the sprint requires
3. **Test your work** — if the sprint involves code changes, make sure they work before moving on

You have full permission to use these tools without asking:

- **Bash commands**: `find`, `ls`, `cat`, `grep`, `mkdir`, `cp`, `mv`, `rm`, `chmod`, `curl`, `wget`, `sed`, `awk`, `sort`, `head`, `tail`, `wc`, `diff`, `tar`, `zip`, `unzip`, `git`, `npm`, `pip`, `python`, `node`, and any other standard CLI tools
- **MySQL**: `mysql` CLI commands, running `.sql` files, database queries, migrations, schema changes
- **Server management**: starting/stopping development servers (Django, FastAPI, Node, etc.)
- **Port management**: killing processes on ports 8000 and 7000 specifically

```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9 2>/dev/null || fuser -k 8000/tcp 2>/dev/null

# Kill process on port 7000
lsof -ti:7000 | xargs kill -9 2>/dev/null || fuser -k 7000/tcp 2>/dev/null
```

### Step 4: Self-Review (After EACH Sprint)

After completing a sprint, do a quick sanity check:
- Did you complete everything the sprint asked for?
- Does the code run without errors?
- No leftover TODOs or placeholder code?

### Step 5: Deep Review (After ALL Sprints in a Folder Complete)

Once all sprints in a folder are done, perform a thorough review. This is critical — treat it like your job depends on it, because it does.

**The review protocol:**

Review your work deeply, every single sprint. Check for:

1. **Logic errors** — does the code actually do what it's supposed to? Trace through the flow mentally. Check edge cases.
2. **Type errors** — wrong types passed to functions, missing type annotations where they matter, implicit type coercion bugs
3. **Runtime errors** — null/undefined access, missing imports, unhandled exceptions, race conditions
4. **Code quality** —
   - No TODO comments left behind
   - No mock/placeholder code
   - No hardcoded URLs that shouldn't be there (dev URLs in prod config, localhost references that should be env vars)
   - No commented-out code blocks
   - No debug print/console.log statements left in
   - Proper error handling everywhere
   - Consistent naming conventions
5. **Completeness** — go back and re-read every sprint file. For each requirement, verify it was actually implemented, not just partially done
6. **Line by line** — literally read through every file you changed, line by line. Look for typos, off-by-one errors, missing edge case handling

**Do this review TWICE.** The first pass catches the obvious stuff. The second pass catches what you missed. Be paranoid. If you find issues, fix them immediately.

After the review, output a summary:
```
## Review Complete: f{XX}
- Files changed: [list]
- Issues found and fixed: [list, or "None"]
- Confidence level: [High/Medium/Low]
- Notes: [anything the user should know]
```

## Running the Pipeline via CLI

For fully automated execution, the user can use the bundled runner script. See `scripts/run_sprints.sh`.

The script is designed to be called like:

```bash
# Run all sprints in all folders
./scripts/run_sprints.sh ./documentation/sprints/financial/

# Run only specific folders
./scripts/run_sprints.sh ./documentation/sprints/financial/ f04 f05 f06

# Run a single folder
./scripts/run_sprints.sh ./documentation/sprints/financial/ f07
```

## Important Notes

- **Context management**: Each sprint should be self-contained. If you notice context getting long, focus on the current sprint and the index.md for the current folder. Don't try to hold all previous sprints in memory.
- **If a sprint fails**: Don't skip it. Debug, fix, and complete it before moving to the next one. If you're truly stuck, tell the user which sprint failed and why.
- **Database safety**: Always check if a migration is destructive before running it. Back up tables if the sprint modifies existing data.
- **Server restarts**: If you need to restart a server, kill the old process first (use the port kill commands above), then start the new one.
- **Git**: If the project uses git, commit after each folder's sprints are complete and reviewed (not after every individual sprint — that's too noisy).

## Claude Code CLI Integration

When running through the CLI pipeline (`claude -p`), use these flags for auto-approval:

```bash
claude -p "your prompt here" \
  --allowedTools "Bash(find:*)" "Bash(ls:*)" "Bash(mysql:*)" "Bash(kill:*)" \
  "Bash(fuser:*)" "Bash(lsof:*)" "Bash(npm:*)" "Bash(node:*)" \
  "Bash(python:*)" "Bash(pip:*)" "Bash(git:*)" "Bash(curl:*)" \
  "Bash(cat:*)" "Bash(grep:*)" "Bash(sed:*)" "Bash(awk:*)" \
  "Bash(mkdir:*)" "Bash(cp:*)" "Bash(mv:*)" "Bash(rm:*)" \
  "Bash(chmod:*)" "Bash(cd:*)" "Bash(echo:*)" "Bash(tar:*)" \
  "Bash(tail:*)" "Bash(head:*)" "Bash(sort:*)" "Bash(wc:*)" \
  "Bash(diff:*)" "Bash(docker:*)" \
  "Edit" "Write" "Read"
```
