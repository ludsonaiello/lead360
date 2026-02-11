#!/bin/bash

BASE_URL="http://localhost:8000/api/v1"
EMAIL="ludsonaiello@gmail.com"
PASSWORD="978@F32c"

echo "=== Comprehensive Sprint 7 Endpoint Testing ==="
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

# Get transcription providers (list to check structure)
echo "2. GET /transcription-providers (list)"
PROVIDERS_LIST=$(curl -s -X GET "${BASE_URL}/admin/communication/transcription-providers" \
  -H "Authorization: Bearer ${TOKEN}")
echo "$PROVIDERS_LIST" | jq '.' > /tmp/providers-list.json
echo "Saved to /tmp/providers-list.json"
echo "$PROVIDERS_LIST" | jq -c '.[] | {id, provider_name, status, is_system_default}' | head -3
echo ""

# Get first provider ID for detail test
PROVIDER_ID=$(echo "$PROVIDERS_LIST" | jq -r '.[0].id // empty')

if [ ! -z "$PROVIDER_ID" ] && [ "$PROVIDER_ID" != "null" ]; then
  echo "3. GET /transcription-providers/:id (detail)"
  curl -s -X GET "${BASE_URL}/admin/communication/transcription-providers/${PROVIDER_ID}" \
    -H "Authorization: Bearer ${TOKEN}" | jq '.' > /tmp/provider-detail.json
  echo "Saved to /tmp/provider-detail.json"
  cat /tmp/provider-detail.json | jq -c '{id, provider_name, model, language, cost_per_minute, usage_limit, usage_current, statistics}'
  echo ""
fi

# Get tenant configs to extract a tenant ID
echo "4. GET /tenant-configs"
TENANT_CONFIGS=$(curl -s -X GET "${BASE_URL}/admin/communication/tenant-configs" \
  -H "Authorization: Bearer ${TOKEN}")
echo "$TENANT_CONFIGS" | jq '.' > /tmp/tenant-configs.json
echo "Saved to /tmp/tenant-configs.json"

# Extract first tenant ID
TENANT_ID=$(echo "$TENANT_CONFIGS" | jq -r '.sms_configs[0].tenant.id // .whatsapp_configs[0].tenant.id // empty')

if [ ! -z "$TENANT_ID" ] && [ "$TENANT_ID" != "null" ]; then
  echo "Found tenant ID: $TENANT_ID"
  echo ""
  
  echo "5. GET /tenants/:id/configs"
  curl -s -X GET "${BASE_URL}/admin/communication/tenants/${TENANT_ID}/configs" \
    -H "Authorization: Bearer ${TOKEN}" | jq '.' > /tmp/tenant-specific-configs.json
  echo "Saved to /tmp/tenant-specific-configs.json"
  cat /tmp/tenant-specific-configs.json | jq -c '{sms_count: (.sms_configs | length), whatsapp_count: (.whatsapp_configs | length)}'
  echo ""
  
  echo "6. GET /tenants/:id/metrics"
  curl -s -X GET "${BASE_URL}/admin/communication/tenants/${TENANT_ID}/metrics" \
    -H "Authorization: Bearer ${TOKEN}" | jq '.' > /tmp/tenant-metrics.json
  echo "Saved to /tmp/tenant-metrics.json"
  cat /tmp/tenant-metrics.json | jq -c '{tenant, calls: .calls.total, sms: .sms.total, whatsapp: .whatsapp.total}'
  echo ""
fi

echo "=== All Response Files Saved ==="
echo "Review files in /tmp/ directory:"
echo "- /tmp/providers-list.json"
echo "- /tmp/provider-detail.json"
echo "- /tmp/tenant-configs.json"
echo "- /tmp/tenant-specific-configs.json"
echo "- /tmp/tenant-metrics.json"
echo ""
echo "Now checking for any discrepancies..."

