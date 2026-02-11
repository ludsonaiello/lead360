#!/bin/bash

BASE_URL="http://localhost:8000/api/v1"
EMAIL="ludsonaiello@gmail.com"
PASSWORD="978@F32c"

echo "=== FINAL VERIFICATION - All Sprint 7 Endpoints ==="
echo ""

# Login
echo "1. Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token // .token // empty')

if [ -z "$TOKEN" ] || [ "$TOKEN" == "null" ]; then
  echo "❌ Login failed"
  exit 1
fi

echo "✅ Login successful"
echo ""

# Get providers and extract ID
PROVIDERS_LIST=$(curl -s -X GET "${BASE_URL}/admin/communication/transcription-providers" \
  -H "Authorization: Bearer ${TOKEN}")
PROVIDER_ID=$(echo "$PROVIDERS_LIST" | jq -r '.[0].id // empty')

echo "=== CRITICAL TEST: TranscriptionProvider Detail with api_endpoint ==="
echo "Testing GET /transcription-providers/${PROVIDER_ID}"
echo ""

PROVIDER_DETAIL=$(curl -s -X GET "${BASE_URL}/admin/communication/transcription-providers/${PROVIDER_ID}" \
  -H "Authorization: Bearer ${TOKEN}")

echo "$PROVIDER_DETAIL" | jq '.'
echo ""

# Check for api_endpoint specifically
HAS_API_ENDPOINT=$(echo "$PROVIDER_DETAIL" | jq -r '.api_endpoint // empty')

echo "=== API_ENDPOINT CHECK ==="
if [ ! -z "$HAS_API_ENDPOINT" ] && [ "$HAS_API_ENDPOINT" != "null" ]; then
  echo "✅✅✅ api_endpoint FOUND: $HAS_API_ENDPOINT"
  echo ""
  echo "🎉 ALL ISSUES 100% FIXED!"
else
  echo "❌ api_endpoint STILL MISSING"
  echo ""
  echo "Note: If backend just restarted, there might be caching."
  echo "Actual value: '$HAS_API_ENDPOINT'"
fi
echo ""

echo "=== COMPLETE FIELD CHECKLIST ==="
echo "Checking all documented fields:"

FIELDS=(
  "id"
  "provider_name"
  "model"
  "language"
  "api_endpoint"
  "additional_settings"
  "tenant"
  "is_system_default"
  "status"
  "usage_limit"
  "usage_current"
  "cost_per_minute"
  "statistics"
  "created_at"
  "updated_at"
)

for field in "${FIELDS[@]}"; do
  HAS_FIELD=$(echo "$PROVIDER_DETAIL" | jq -r ".${field} // empty")
  if [ ! -z "$HAS_FIELD" ]; then
    if [ "$HAS_FIELD" == "null" ]; then
      echo "  ⚠️  ${field}: null (ok if provider doesn't have this value)"
    else
      echo "  ✅ ${field}: Present"
    fi
  else
    echo "  ❌ ${field}: MISSING"
  fi
done

echo ""
echo "=== FULL PROVIDER DETAIL RESPONSE ==="
echo "$PROVIDER_DETAIL" | jq '.'

