#!/usr/bin/env sh
set -eu

echo "vpc ${VPC_ID}"

nat_ids=$(aws ec2 describe-nat-gateways \
  --filter "Name=vpc-id,Values=${VPC_ID}" "Name=state,Values=available" \
  --query 'NatGateways[].NatGatewayId' \
  --output text)

if [ -z "${nat_ids}" ] || [ "${nat_ids}" = "None" ]; then
  echo "MISSING  NAT gateway in vpc ${VPC_ID}"
  echo "done"
  exit 1
fi

all_ips=""

for nat_id in ${nat_ids}; do
  echo "nat gateway ${nat_id}"

  echo "nat gateway details"
  aws ec2 describe-nat-gateways --nat-gateway-ids "${nat_id}" --output table

  subnet=$(aws ec2 describe-nat-gateways \
    --nat-gateway-ids "${nat_id}" \
    --query 'NatGateways[0].SubnetId' \
    --output text)
  public_ips=$(aws ec2 describe-nat-gateways \
    --nat-gateway-ids "${nat_id}" \
    --query 'NatGateways[0].NatGatewayAddresses[].PublicIp' \
    --output text)
  allocation_ids=$(aws ec2 describe-nat-gateways \
    --nat-gateway-ids "${nat_id}" \
    --query 'NatGateways[0].NatGatewayAddresses[].AllocationId' \
    --output text)

  if [ -n "${allocation_ids}" ] && [ "${allocation_ids}" != "None" ]; then
    echo "elastic ips"
    aws ec2 describe-addresses --allocation-ids ${allocation_ids} --output table
  fi

  echo "summary"
  echo "nat        ${nat_id}"
  echo "subnet     ${subnet}"
  echo "egress_ips ${public_ips}"

  echo "FOUND    NAT gateway"

  if [ -n "${public_ips}" ] && [ "${public_ips}" != "None" ]; then
    echo "FOUND    egress IP (${public_ips})"
    all_ips="${all_ips} ${public_ips}"
  else
    echo "MISSING  egress IP"
  fi
done

echo "egress ips"
if [ -n "${all_ips}" ]; then
  printf '%s\n' ${all_ips} | sort -u | sed 's/^/  /'
else
  echo "  <none>"
fi

echo "done"
