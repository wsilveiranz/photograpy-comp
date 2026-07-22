#!/usr/bin/env bash

set -u

emit_empty() {
  printf '{}\n'
  exit 0
}

payload="$(cat 2>/dev/null)" || emit_empty
[ -n "$payload" ] || emit_empty

python_code="$(cat <<'PY'
import json
import os
import re
import shutil
import subprocess
import sys

WARNING = '⚠️ Commit lint: Your last commit does not reference a GitHub issue (Fixes #N or Closes #N). This violates the issue-first workflow. Please amend the commit with: git commit --amend -m "<message>\\n\\nFixes #N\\n\\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"'
GIT_COMMIT_PATTERN = re.compile(r'(?is)\bgit\b[^\r\n]*\bcommit\b')
SUCCESS_PATTERN = re.compile(r'(?im)^\[[^\]\r\n]*\b[0-9a-f]{7,40}\]')
ISSUE_PATTERN = re.compile(r'(?im)\b(?:Fixes|Closes)\s+#\d+\b')

def emit(obj):
    json.dump(obj, sys.stdout, ensure_ascii=False)
    sys.stdout.write('\n')
    raise SystemExit(0)

def is_exempt(path_text):
    normalized = path_text.replace('\\', '/')
    leaf_name = os.path.basename(normalized)
    return (
        normalized.startswith('.github/')
        or normalized.startswith('docs/')
        or normalized.startswith('apps/docs/')
        or normalized.lower().endswith('.md')
        or leaf_name.lower() == 'package-lock.json'
    )

def run_git(cwd, *args):
    try:
        completed = subprocess.run(
            ['git', '-C', cwd, *args],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except Exception:
        return None

    if completed.returncode != 0:
        return None

    return completed.stdout

try:
    payload = json.load(sys.stdin)
except Exception:
    emit({})

tool_args = payload.get('toolArgs')
if isinstance(tool_args, str):
    command_text = tool_args
elif isinstance(tool_args, dict):
    command_text = tool_args.get('command', '') or ''
else:
    command_text = ''

if not GIT_COMMIT_PATTERN.search(command_text or ''):
    emit({})

tool_result = payload.get('toolResult') or {}
result_text = tool_result.get('textResultForLlm') or ''
if not SUCCESS_PATTERN.search(result_text):
    emit({})

cwd = payload.get('cwd') or ''
if not cwd or shutil.which('git') is None:
    emit({})

if run_git(cwd, 'rev-parse', '--is-inside-work-tree') is None:
    emit({})

commit_message = run_git(cwd, 'log', '-1', '--pretty=%B')
if commit_message is None or ISSUE_PATTERN.search(commit_message):
    emit({})

changed_files_output = run_git(cwd, 'diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD')
if changed_files_output is None:
    emit({})

changed_files = [line.strip() for line in changed_files_output.splitlines() if line.strip()]
if not changed_files or all(is_exempt(path_text) for path_text in changed_files):
    emit({})

emit({'additionalContext': WARNING})
PY
)"

node_code="$(cat <<'NODE'
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const WARNING = '⚠️ Commit lint: Your last commit does not reference a GitHub issue (Fixes #N or Closes #N). This violates the issue-first workflow. Please amend the commit with: git commit --amend -m "<message>\\n\\nFixes #N\\n\\nCo-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"';
const GIT_COMMIT_PATTERN = /\bgit\b[^\r\n]*\bcommit\b/is;
const SUCCESS_PATTERN = /^\[[^\]\r\n]*\b[0-9a-f]{7,40}\]/im;
const ISSUE_PATTERN = /\b(?:Fixes|Closes)\s+#\d+\b/im;

function emit(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`);
  process.exit(0);
}

function isExempt(pathText) {
  const normalized = pathText.replace(/\\/g, '/');
  const leafName = path.basename(normalized).toLowerCase();
  return normalized.startsWith('.github/')
    || normalized.startsWith('docs/')
    || normalized.startsWith('apps/docs/')
    || normalized.toLowerCase().endsWith('.md')
    || leafName === 'package-lock.json';
}

function runGit(cwd, args) {
  try {
    return execFileSync('git', ['-C', cwd, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    });
  } catch {
    return null;
  }
}

let payload;
try {
  payload = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch {
  emit({});
}

const toolArgs = payload.toolArgs;
const commandText = typeof toolArgs === 'string'
  ? toolArgs
  : (toolArgs && typeof toolArgs.command === 'string' ? toolArgs.command : '');

if (!GIT_COMMIT_PATTERN.test(commandText || '')) {
  emit({});
}

const resultText = ((payload.toolResult || {}).textResultForLlm) || '';
if (!SUCCESS_PATTERN.test(resultText)) {
  emit({});
}

const cwd = payload.cwd || '';
if (!cwd) {
  emit({});
}

const insideRepo = runGit(cwd, ['rev-parse', '--is-inside-work-tree']);
if (insideRepo === null) {
  emit({});
}

const commitMessage = runGit(cwd, ['log', '-1', '--pretty=%B']);
if (commitMessage === null || ISSUE_PATTERN.test(commitMessage)) {
  emit({});
}

const changedFilesOutput = runGit(cwd, ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD']);
if (changedFilesOutput === null) {
  emit({});
}

const changedFiles = changedFilesOutput
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

if (changedFiles.length === 0 || changedFiles.every(isExempt)) {
  emit({});
}

emit({ additionalContext: WARNING });
NODE
)"

if command -v node >/dev/null 2>&1 && node -e "" >/dev/null 2>&1; then
  printf '%s' "$payload" | node -e "$node_code"
  exit 0
fi

if command -v python3 >/dev/null 2>&1 && python3 -c "import sys" >/dev/null 2>&1; then
  printf '%s' "$payload" | python3 -c "$python_code"
  exit 0
fi

if command -v python >/dev/null 2>&1 && python -c "import sys" >/dev/null 2>&1; then
  printf '%s' "$payload" | python -c "$python_code"
  exit 0
fi

emit_empty
