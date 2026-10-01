#!/usr/bin/env sh
set -eu

echo "hosted zone ${ROUTE53_ZONE_ID}"

echo "zone details"
aws route53 get-hosted-zone --id "${ROUTE53_ZONE_ID}" --output table

echo "zone records"
aws route53 list-resource-record-sets --hosted-zone-id "${ROUTE53_ZONE_ID}" --output table

echo "zone tags"
aws route53 list-tags-for-resource --resource-type hostedzone --resource-id "${ROUTE53_ZONE_ID}" --output table

records=$(aws route53 list-resource-record-sets \
  --hosted-zone-id "${ROUTE53_ZONE_ID}" \
  --query 'ResourceRecordSets[].[Type,Name,ResourceRecords[0].Value,AliasTarget.DNSName]' \
  --output text)

tags=$(aws route53 list-tags-for-resource \
  --resource-type hostedzone \
  --resource-id "${ROUTE53_ZONE_ID}" \
  --query 'ResourceTagSet.Tags[].[Key,Value]' \
  --output text)

check() {
  label="$1"
  pattern="$2"
  haystack="$3"
  if printf '%s\n' "$haystack" | grep -Eq "$pattern"; then
    echo "FOUND    ${label}"
  else
    echo "MISSING  ${label}"
  fi
}

echo "summary"
check "CAA" "^CAA[[:space:]]" "$records"
check "NS" "^NS[[:space:]]" "$records"
check "SOA" "^SOA[[:space:]]" "$records"
check "ACM validation CNAME" "acm-validations" "$records"
check "app A alias" "^A[[:space:]]app\\." "$records"
check "app TXT" "^TXT[[:space:]]app\\." "$records"
check "cname-app TXT" "^TXT[[:space:]]cname-app\\." "$records"
check "tag NUON_INSTALL_ID" "^NUON_INSTALL_ID[[:space:]]" "$tags"
check "tag install.nuon.co/id" "^install\\.nuon\\.co/id[[:space:]]" "$tags"
check "tag sandbox.nuon.co/name" "^sandbox\\.nuon\\.co/name[[:space:]]" "$tags"

echo "done"
