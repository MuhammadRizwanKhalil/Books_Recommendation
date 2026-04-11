#!/bin/bash
# Trigger a book import via the admin API
set -e

TOKEN=$(curl -s -X POST https://thebooktimes.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"rizwankhalil87@gmail.com","password":"o6SNgYdeMih2iwP/F7Lk9zUxfEl3FzrJ"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')

echo "Got token: ${TOKEN:0:20}..."

RESULT=$(curl -s -X POST https://thebooktimes.com/api/import/run \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"type":"daily"}')

echo "Import trigger result: $RESULT"
