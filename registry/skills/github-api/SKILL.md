---
name: github-api
description: >
  GitHub API integration for repository management and code operations.
  Use this skill when you need to interact with GitHub repositories,
  manage issues, pull requests, or access repository data.
allowed-tools: Bash(gh *) Bash(curl *) Read Write
compatibility: Requires GITHUB_TOKEN environment variable
metadata:
  author: openstaff
  version: "1.0"
---

## Setup

This skill requires a GitHub personal access token set as `GITHUB_TOKEN`.

## Usage

### Using gh CLI
```bash
# List open issues
gh issue list --repo owner/repo

# Create a pull request
gh pr create --title "Title" --body "Description"

# View repository info
gh repo view owner/repo
```

### Using GitHub API directly
```bash
curl -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/repos/owner/repo/issues"
```

### Tips
- Use gh CLI when possible for simpler syntax
- Rate limit: 5000 requests/hour with authentication
- Always check existing issues/PRs before creating new ones
