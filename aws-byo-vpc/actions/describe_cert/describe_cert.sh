#!/usr/bin/env sh
set -eu

echo "certificate ${ACM_CERT_ARN}"

echo "certificate details"
aws acm describe-certificate --certificate-arn "${ACM_CERT_ARN}" --output table

echo "certificate tags"
aws acm list-tags-for-certificate --certificate-arn "${ACM_CERT_ARN}" --output table

status=$(aws acm describe-certificate --certificate-arn "${ACM_CERT_ARN}" --query 'Certificate.Status' --output text)
domain=$(aws acm describe-certificate --certificate-arn "${ACM_CERT_ARN}" --query 'Certificate.DomainName' --output text)
in_use=$(aws acm describe-certificate --certificate-arn "${ACM_CERT_ARN}" --query 'length(Certificate.InUseBy)' --output text)
validation=$(aws acm describe-certificate --certificate-arn "${ACM_CERT_ARN}" --query 'Certificate.DomainValidationOptions[].ValidationStatus' --output text)
record=$(aws acm describe-certificate --certificate-arn "${ACM_CERT_ARN}" --query 'Certificate.DomainValidationOptions[].ResourceRecord.Name' --output text)

check() {
  label="$1"
  ok="$2"
  if [ "$ok" = "yes" ]; then
    echo "FOUND    ${label}"
  else
    echo "MISSING  ${label}"
  fi
}

echo "summary"
echo "status     ${status}"
echo "domain     ${domain}"
if [ "$status" = "ISSUED" ]; then
  echo "FOUND    status ISSUED"
else
  echo "MISSING  status ISSUED (got ${status})"
fi
if printf '%s\n' "$validation" | grep -Eq 'PENDING_VALIDATION|FAILED|None|^$'; then
  echo "MISSING  DNS validation SUCCESS (got ${validation})"
else
  echo "FOUND    DNS validation SUCCESS"
fi
if [ -n "$record" ] && [ "$record" != "None" ]; then
  echo "FOUND    ACM validation CNAME"
else
  echo "MISSING  ACM validation CNAME"
fi
if [ "${in_use:-0}" != "0" ] && [ "$in_use" != "None" ]; then
  echo "FOUND    InUseBy (${in_use})"
else
  echo "MISSING  InUseBy"
fi

echo "done"
