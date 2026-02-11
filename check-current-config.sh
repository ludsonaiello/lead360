#!/bin/bash

BASE_URL="http://localhost:8000/api/v1"
EMAIL="ludsonaiello@gmail.com"
PASSWORD="978@F32c"

# Login
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token // .token // empty')

# Get tenant configs
TENANT_CONFIGS=$(curl -s -X GET "${BASE_URL}/admin/communication/tenant-configs" \
  -H "Authorization: Bearer ${TOKEN}")

echo "SMS Config Structure:"
echo "$TENANT_CONFIGS" | jq '.sms_configs[0]'

