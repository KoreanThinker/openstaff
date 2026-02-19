---
name: web-scraping
description: >
  Web scraping utilities for gathering data from websites.
  Use this skill when you need to collect information from web pages,
  extract structured data, or monitor website changes.
allowed-tools: Bash(curl *) Bash(node *) Read Write
metadata:
  author: openstaff
  version: "1.0"
---

## Usage

Use curl or a Node.js script to fetch web pages and extract data.

### Fetch a page
```bash
curl -s "https://example.com" -o page.html
```

### Extract data with Node.js
Write a script that uses built-in Node.js modules to parse HTML:
```bash
node scripts/scrape.js "https://example.com"
```

### Tips
- Always respect robots.txt and rate limits
- Add appropriate delays between requests (minimum 1 second)
- Store scraped data as JSON for easy processing
- Use User-Agent headers to identify your requests
