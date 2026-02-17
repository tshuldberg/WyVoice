#!/bin/bash
# parallel-plan-runner.sh — Run plan files in parallel via git worktrees
# Usage: ./docs/plans/scripts/parallel-plan-runner.sh [max-concurrent] [plans-dir]
set -euo pipefail

MAX_CONCURRENT=${1:-4}
PLANS_DIR="${2:-docs/plans}"
QUEUE="$PLANS_DIR/queue"
DONE="$PLANS_DIR/done"
FAILED="$PLANS_DIR/failed"
LOGS="$PLANS_DIR/logs"
REPO_ROOT="$(git rev-parse --show-toplevel)"

mkdir -p "$DONE" "$FAILED" "$LOGS"

plan_count=$(ls "$QUEUE"/*.md 2>/dev/null | wc -l | tr -d ' ')
if [ "$plan_count" -eq 0 ]; then
  echo "No plans in queue ($QUEUE/). Nothing to do."
  exit 0
fi

echo "=== Parallel Plan Runner ==="
echo "Found $plan_count plan(s), max $MAX_CONCURRENT concurrent"
echo ""

run_plan_in_worktree() {
  local plan_file="$1"
  local plan_name
  plan_name=$(basename "$plan_file" .md)
  local worktree_dir="${REPO_ROOT}/../Apps-wt-${plan_name}"
  local timestamp
  timestamp=$(date +%Y%m%d-%H%M%S)
  local log_file="${REPO_ROOT}/${LOGS}/${plan_name}-${timestamp}.json"
  local branch_name="plan/${plan_name}"

  echo "[${plan_name}] Creating worktree at $worktree_dir"

  # Create worktree with new branch
  if ! git -C "$REPO_ROOT" worktree add "$worktree_dir" -b "$branch_name" 2>/dev/null; then
    # Branch might already exist — try checking it out
    if ! git -C "$REPO_ROOT" worktree add "$worktree_dir" "$branch_name" 2>/dev/null; then
      echo "[${plan_name}] FAILED: Could not create worktree"
      mv "$plan_file" "${REPO_ROOT}/${FAILED}/"
      return 1
    fi
  fi

  # Copy plan into worktree
  cp "$plan_file" "$worktree_dir/"

  echo "[${plan_name}] Running Claude in worktree..."

  # Execute in worktree
  if (cd "$worktree_dir" && claude -p "Execute this implementation plan completely. Follow each phase in order. Check off each step as you complete it. If you hit a blocker you cannot resolve, explain what blocked you and stop.

$(cat "$(basename "$plan_file")")" \
    --allowedTools "Read,Edit,Write,Bash,Glob,Grep" \
    --output-format json > "$log_file" 2>&1); then
    mv "$plan_file" "${REPO_ROOT}/${DONE}/"
    echo "[${plan_name}] COMPLETED (log: $log_file)"
  else
    mv "$plan_file" "${REPO_ROOT}/${FAILED}/"
    echo "[${plan_name}] FAILED (log: $log_file)"
  fi

  # Cleanup worktree (leave branch for review)
  git -C "$REPO_ROOT" worktree remove "$worktree_dir" --force 2>/dev/null || true
}

export -f run_plan_in_worktree
export REPO_ROOT DONE FAILED LOGS

# Run plans in parallel, limited to MAX_CONCURRENT
ls "$QUEUE"/*.md 2>/dev/null | sort | \
  xargs -P "$MAX_CONCURRENT" -I {} bash -c 'run_plan_in_worktree "$@"' _ {}

echo ""
echo "=== All plans dispatched ==="
echo "  Check $DONE/ for completed plans"
echo "  Check $FAILED/ for failed plans"
echo "  Check $LOGS/ for execution logs"
echo "  Run 'git worktree list' to see any remaining worktrees"
echo "  Run 'git branch --list plan/*' to see plan branches for review"
