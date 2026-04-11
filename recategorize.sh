#!/bin/bash
# Script to trigger recategorization

# Use docker network to connect to server
SERVER_IP=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' thebooktimes-server)

echo "Server IP: $SERVER_IP"

# Get admin token
TOKEN=$(curl -s -X POST "http://$SERVER_IP:3001/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"rizwankhalil87@gmail.com","password":"o6SNgYdeMih2iwP/F7Lk9zUxfEl3FzrJ"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

echo "Token: ${TOKEN:0:20}..."

if [ -z "$TOKEN" ]; then
  echo "Failed to get token"
  exit 1
fi

# Trigger recategorization
curl -s -X POST "http://$SERVER_IP:3001/api/import/recategorize" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN"
