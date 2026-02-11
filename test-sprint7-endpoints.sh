#!/bin/bash

# Sprint 7 Endpoint Testing Script
# Testing all 11 endpoints before implementation

BASE_URL="http://localhost:8000/api/v1"
EMAIL="ludsonaiello@gmail.com"
PASSWORD="978@F32c"

echo "=== Sprint 7 Endpoint Testing ==="
echo ""

# Step 1: Login to get JWT token
echo "1. Logging in to get JWT token..."
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token // .token // empty')

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  echo "❌ Login failed. Response:"
  echo "$LOGIN_RESPONSE" | jq '.'
  exit 1
fi

echo "✅ Login successful. Token obtained."
echo ""

# Test each endpoint
echo "=== Testing Transcription Provider Endpoints ==="
echo ""

# First, get list of transcription providers to check response structure
echo "2. GET /transcription-providers (list existing)"
curl -s -X GET "${BASE_URL}/admin/communication/transcription-providers" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" | jq '.' > /tmp/transcription-providers-list.json

echo "Response saved to /tmp/transcription-providers-list.json"
cat /tmp/transcription-providers-list.json
echo ""

# Get available phone numbers for tenant assistance
echo "3. GET /twilio/phone-numbers (for tenant assistance)"
curl -s -X GET "${BASE_URL}/admin/communication/twilio/phone-numbers" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" | jq '.' > /tmp/phone-numbers.json

echo "Response saved to /tmp/phone-numbers.json"
cat /tmp/phone-numbers.json
echo ""

# Get tenant configs to check structure
echo "4. GET /tenant-configs (for tenant assistance)"
curl -s -X GET "${BASE_URL}/admin/communication/tenant-configs" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" | jq '.' > /tmp/tenant-configs.json

echo "Response saved to /tmp/tenant-configs.json"
cat /tmp/tenant-configs.json
echo ""

echo "=== Testing Complete ==="
echo "Review the responses above to verify they match the documentation."
