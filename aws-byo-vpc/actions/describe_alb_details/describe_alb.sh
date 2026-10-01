#!/usr/bin/env sh
set -eu

echo "install ${INSTALL_ID}"

alb_arns=$(aws resourcegroupstaggingapi get-resources \
  --resource-type-filters "elasticloadbalancing:loadbalancer" \
  --tag-filters "Key=nuon_install_id,Values=${INSTALL_ID}" \
  --query 'ResourceTagMappingList[].ResourceARN' \
  --output text)

if [ -z "${alb_arns}" ] || [ "${alb_arns}" = "None" ]; then
  echo "MISSING  ALB tagged nuon_install_id=${INSTALL_ID}"
  echo "done"
  exit 1
fi

for arn in ${alb_arns}; do
  echo "load balancer ${arn}"

  echo "load balancer details"
  aws elbv2 describe-load-balancers --load-balancer-arns "${arn}" --output table

  echo "listeners"
  aws elbv2 describe-listeners --load-balancer-arn "${arn}" --output table

  echo "target groups"
  aws elbv2 describe-target-groups --load-balancer-arn "${arn}" --output table

  echo "tags"
  aws elbv2 describe-tags --resource-arns "${arn}" --output table

  echo "attributes"
  aws elbv2 describe-load-balancer-attributes --load-balancer-arn "${arn}" --output table

  name=$(aws elbv2 describe-load-balancers --load-balancer-arns "${arn}" --query 'LoadBalancers[0].LoadBalancerName' --output text)
  scheme=$(aws elbv2 describe-load-balancers --load-balancer-arns "${arn}" --query 'LoadBalancers[0].Scheme' --output text)
  state=$(aws elbv2 describe-load-balancers --load-balancer-arns "${arn}" --query 'LoadBalancers[0].State.Code' --output text)
  dns=$(aws elbv2 describe-load-balancers --load-balancer-arns "${arn}" --query 'LoadBalancers[0].DNSName' --output text)
  vpc=$(aws elbv2 describe-load-balancers --load-balancer-arns "${arn}" --query 'LoadBalancers[0].VpcId' --output text)
  lb_type=$(aws elbv2 describe-load-balancers --load-balancer-arns "${arn}" --query 'LoadBalancers[0].Type' --output text)
  https=$(aws elbv2 describe-listeners --load-balancer-arn "${arn}" --query 'Listeners[?Protocol==`HTTPS`].Port' --output text)
  certs=$(aws elbv2 describe-listeners --load-balancer-arn "${arn}" --query 'Listeners[].Certificates[].CertificateArn' --output text)
  targets=$(aws elbv2 describe-target-groups --load-balancer-arn "${arn}" --query 'length(TargetGroups)' --output text)

  echo "summary"
  echo "name       ${name}"
  echo "type       ${lb_type}"
  echo "scheme     ${scheme}"
  echo "state      ${state}"
  echo "dns        ${dns}"
  echo "vpc        ${vpc}"

  if [ "${state}" = "active" ]; then
    echo "FOUND    state active"
  else
    echo "MISSING  state active (got ${state})"
  fi

  if [ "${lb_type}" = "application" ]; then
    if [ "${scheme}" = "internet-facing" ]; then
      echo "FOUND    scheme internet-facing"
    else
      echo "MISSING  scheme internet-facing (got ${scheme})"
    fi

    if [ -n "${https}" ] && [ "${https}" != "None" ]; then
      echo "FOUND    HTTPS listener (${https})"
    else
      echo "MISSING  HTTPS listener"
    fi

    if [ -n "${certs}" ] && [ "${certs}" != "None" ]; then
      echo "FOUND    listener certificate"
    else
      echo "MISSING  listener certificate"
    fi
  fi

  if [ -n "${dns}" ] && [ "${dns}" != "None" ]; then
    echo "FOUND    DNS name"
  else
    echo "MISSING  DNS name"
  fi

  if [ "${targets:-0}" != "0" ] && [ "${targets}" != "None" ]; then
    echo "FOUND    target groups (${targets})"
  else
    echo "MISSING  target groups"
  fi
done

echo "done"
