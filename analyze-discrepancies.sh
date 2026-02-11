#!/bin/bash

echo "=== Analyzing API Response vs Documentation ==="
echo ""

echo "1. Provider List Response Structure:"
cat /tmp/providers-list.json | jq '.[0]'
echo ""

echo "2. Provider Detail Response Structure:"
cat /tmp/provider-detail.json | jq '.'
echo ""

echo "3. Tenant Configs Response Structure:"
cat /tmp/tenant-configs.json | jq '{
  sms_configs_structure: .sms_configs[0],
  whatsapp_configs: .whatsapp_configs,
  ivr_configs: .ivr_configs,
  total_tenants: .total_tenants,
  total_configs: .total_configs
}'
echo ""

echo "4. Tenant Specific Configs:"
cat /tmp/tenant-specific-configs.json | jq '.'
echo ""

echo "5. Tenant Metrics:"
cat /tmp/tenant-metrics.json | jq '.'
echo ""

echo "=== DISCREPANCIES FOUND ==="
echo ""
echo "Comparing with documentation..."
echo ""

# Check TranscriptionProvider structure
echo "TranscriptionProvider LIST properties found:"
cat /tmp/providers-list.json | jq -r '.[0] | keys | .[]' | sort
echo ""

echo "TranscriptionProvider DETAIL properties found:"
cat /tmp/provider-detail.json | jq -r 'keys | .[]' | sort
echo ""

echo "Documentation says TranscriptionProviderDetail should have:"
echo "- id, tenant, provider_name, api_endpoint, model, language"
echo "- additional_settings, is_system_default, status"
echo "- usage_limit, usage_current, cost_per_minute, statistics"
echo "- created_at, updated_at"
echo ""

echo "Checking what's missing or extra..."
cat /tmp/provider-detail.json | jq 'keys' > /tmp/actual-keys.json

echo "Actual keys found:"
cat /tmp/actual-keys.json | jq -r '.[]'

