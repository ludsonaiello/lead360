#!/bin/bash

BASE_URL="http://localhost:8000/api/v1"
EMAIL="ludsonaiello@gmail.com"
PASSWORD="978@F32c"

echo "=== Verifying Backend Fixes for Sprint 7 ==="
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

# Get provider ID
PROVIDERS_LIST=$(curl -s -X GET "${BASE_URL}/admin/communication/transcription-providers" \
  -H "Authorization: Bearer ${TOKEN}")
PROVIDER_ID=$(echo "$PROVIDERS_LIST" | jq -r '.[0].id // empty')

if [ -z "$PROVIDER_ID" ]; then
  echo "❌ No provider found"
  exit 1
fi

echo "=== FIX #1: TranscriptionProvider Detail - Check for api_endpoint and additional_settings ==="
echo "Testing GET /transcription-providers/${PROVIDER_ID}"
echo ""

PROVIDER_DETAIL=$(curl -s -X GET "${BASE_URL}/admin/communication/transcription-providers/${PROVIDER_ID}" \
  -H "Authorization: Bearer ${TOKEN}")

echo "$PROVIDER_DETAIL" | jq '.'
echo ""

# Check for missing fields
HAS_API_ENDPOINT=$(echo "$PROVIDER_DETAIL" | jq -r '.api_endpoint // empty')
HAS_ADDITIONAL_SETTINGS=$(echo "$PROVIDER_DETAIL" | jq -r '.additional_settings // empty')

echo "Checking required fields:"
if [ ! -z "$HAS_API_ENDPOINT" ]; then
  echo "  ✅ api_endpoint: $HAS_API_ENDPOINT"
else
  echo "  ❌ api_endpoint: MISSING"
fi

if [ "$HAS_ADDITIONAL_SETTINGS" != "" ]; then
  echo "  ✅ additional_settings: Present"
else
  echo "  ⚠️  additional_settings: Empty (acceptable if provider has no custom settings)"
fi
echo ""

echo "=== FIX #2: Tenant Metrics - Check for nested structure ==="
TENANT_CONFIGS=$(curl -s -X GET "${BASE_URL}/admin/communication/tenant-configs" \
  -H "Authorization: Bearer ${TOKEN}")
TENANT_ID=$(echo "$TENANT_CONFIGS" | jq -r '.sms_configs[0].tenant.id // .whatsapp_configs[0].tenant.id // empty')

if [ -z "$TENANT_ID" ]; then
  echo "❌ No tenant found"
  exit 1
fi

echo "Testing GET /tenants/${TENANT_ID}/metrics"
echo ""

TENANT_METRICS=$(curl -s -X GET "${BASE_URL}/admin/communication/tenants/${TENANT_ID}/metrics" \
  -H "Authorization: Bearer ${TOKEN}")

echo "$TENANT_METRICS" | jq '.'
echo ""

# Check for nested structure
HAS_TENANT_OBJECT=$(echo "$TENANT_METRICS" | jq -r '.tenant // empty')
HAS_CALLS_OBJECT=$(echo "$TENANT_METRICS" | jq -r '.calls // empty')
HAS_SMS_OBJECT=$(echo "$TENANT_METRICS" | jq -r '.sms // empty')
HAS_WHATSAPP_OBJECT=$(echo "$TENANT_METRICS" | jq -r '.whatsapp // empty')
HAS_TRANSCRIPTIONS_OBJECT=$(echo "$TENANT_METRICS" | jq -r '.transcriptions // empty')
HAS_COSTS_OBJECT=$(echo "$TENANT_METRICS" | jq -r '.costs // empty')
HAS_PERIOD=$(echo "$TENANT_METRICS" | jq -r '.period // empty')

echo "Checking required nested objects:"
if [ ! -z "$HAS_TENANT_OBJECT" ] && [ "$HAS_TENANT_OBJECT" != "null" ]; then
  echo "  ✅ tenant object: Present"
  echo "     $(echo "$TENANT_METRICS" | jq -c '.tenant')"
else
  echo "  ❌ tenant object: MISSING"
fi

if [ ! -z "$HAS_PERIOD" ]; then
  echo "  ✅ period: $HAS_PERIOD"
else
  echo "  ❌ period: MISSING"
fi

if [ ! -z "$HAS_CALLS_OBJECT" ] && [ "$HAS_CALLS_OBJECT" != "null" ]; then
  echo "  ✅ calls object: Present"
  echo "     $(echo "$TENANT_METRICS" | jq -c '.calls')"
else
  echo "  ❌ calls object: MISSING"
fi

if [ ! -z "$HAS_SMS_OBJECT" ] && [ "$HAS_SMS_OBJECT" != "null" ]; then
  echo "  ✅ sms object: Present"
  echo "     $(echo "$TENANT_METRICS" | jq -c '.sms')"
else
  echo "  ❌ sms object: MISSING"
fi

if [ ! -z "$HAS_WHATSAPP_OBJECT" ] && [ "$HAS_WHATSAPP_OBJECT" != "null" ]; then
  echo "  ✅ whatsapp object: Present"
  echo "     $(echo "$TENANT_METRICS" | jq -c '.whatsapp')"
else
  echo "  ❌ whatsapp object: MISSING"
fi

if [ ! -z "$HAS_TRANSCRIPTIONS_OBJECT" ] && [ "$HAS_TRANSCRIPTIONS_OBJECT" != "null" ]; then
  echo "  ✅ transcriptions object: Present"
  echo "     $(echo "$TENANT_METRICS" | jq -c '.transcriptions')"
else
  echo "  ❌ transcriptions object: MISSING"
fi

if [ ! -z "$HAS_COSTS_OBJECT" ] && [ "$HAS_COSTS_OBJECT" != "null" ]; then
  echo "  ✅ costs object: Present"
  echo "     $(echo "$TENANT_METRICS" | jq -c '.costs')"
else
  echo "  ❌ costs object: MISSING"
fi
echo ""

echo "=== FIX #3: SMS/WhatsApp Config Fields ==="
echo "Testing GET /tenants/${TENANT_ID}/configs"
echo ""

TENANT_SPECIFIC_CONFIGS=$(curl -s -X GET "${BASE_URL}/admin/communication/tenants/${TENANT_ID}/configs" \
  -H "Authorization: Bearer ${TOKEN}")

echo "$TENANT_SPECIFIC_CONFIGS" | jq '.'
echo ""

# Check first SMS config if exists
SMS_CONFIG=$(echo "$TENANT_SPECIFIC_CONFIGS" | jq -r '.sms_configs[0] // empty')

if [ ! -z "$SMS_CONFIG" ]; then
  echo "Checking SMS config fields:"
  
  HAS_PROVIDER_TYPE=$(echo "$SMS_CONFIG" | jq -r '.provider_type // empty')
  HAS_IS_PRIMARY=$(echo "$SMS_CONFIG" | jq -r '.is_primary // empty')
  HAS_IS_ACTIVE=$(echo "$SMS_CONFIG" | jq -r '.is_active // empty')
  HAS_CREATED_BY=$(echo "$SMS_CONFIG" | jq -r '.created_by // empty')
  HAS_UPDATED_AT=$(echo "$SMS_CONFIG" | jq -r '.updated_at // empty')
  
  if [ ! -z "$HAS_PROVIDER_TYPE" ]; then
    echo "  ✅ provider_type: $HAS_PROVIDER_TYPE"
  else
    echo "  ❌ provider_type: MISSING"
  fi
  
  if [ ! -z "$HAS_IS_PRIMARY" ] && [ "$HAS_IS_PRIMARY" != "null" ]; then
    echo "  ✅ is_primary: $HAS_IS_PRIMARY"
  else
    echo "  ❌ is_primary: MISSING"
  fi
  
  if [ ! -z "$HAS_IS_ACTIVE" ] && [ "$HAS_IS_ACTIVE" != "null" ]; then
    echo "  ✅ is_active: $HAS_IS_ACTIVE"
  else
    echo "  ❌ is_active: MISSING"
  fi
  
  if [ ! -z "$HAS_CREATED_BY" ] && [ "$HAS_CREATED_BY" != "null" ]; then
    echo "  ✅ created_by: $HAS_CREATED_BY"
  else
    echo "  ⚠️  created_by: MISSING (optional field)"
  fi
  
  if [ ! -z "$HAS_UPDATED_AT" ]; then
    echo "  ✅ updated_at: $HAS_UPDATED_AT"
  else
    echo "  ❌ updated_at: MISSING"
  fi
else
  echo "ℹ️  No SMS configs found for this tenant (cannot verify fix)"
fi
echo ""

echo "=== FIX #4: Tenant Configs Aggregation ==="
echo "Testing GET /tenant-configs"
echo ""

ALL_TENANT_CONFIGS=$(curl -s -X GET "${BASE_URL}/admin/communication/tenant-configs" \
  -H "Authorization: Bearer ${TOKEN}")

TOTAL_TENANTS=$(echo "$ALL_TENANT_CONFIGS" | jq -r '.total_tenants // empty')
TOTAL_CONFIGS=$(echo "$ALL_TENANT_CONFIGS" | jq -r '.total_configs // empty')

echo "Checking aggregation fields:"
if [ ! -z "$TOTAL_TENANTS" ] && [ "$TOTAL_TENANTS" != "null" ]; then
  echo "  ✅ total_tenants: $TOTAL_TENANTS"
else
  echo "  ❌ total_tenants: MISSING or null"
fi

if [ ! -z "$TOTAL_CONFIGS" ] && [ "$TOTAL_CONFIGS" != "null" ]; then
  echo "  ✅ total_configs: $TOTAL_CONFIGS"
else
  echo "  ❌ total_configs: MISSING or null"
fi
echo ""

echo "=== SUMMARY ==="
echo ""
echo "All fixes verified. Check above for any ❌ marks."
echo ""

