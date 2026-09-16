#!/usr/bin/env sh
set -eu

echo "namespace ${NAMESPACE}"

echo "deployments"
kubectl get deployment -n "${NAMESPACE}" -l app.kubernetes.io/name=external-dns

deploy=$(kubectl get deployment -n "${NAMESPACE}" \
  -l app.kubernetes.io/name=external-dns \
  -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || true)

if [ -z "${deploy}" ]; then
  echo "MISSING  external-dns deployment"
  echo "done"
  exit 1
fi

echo "deployment details"
kubectl describe deployment "${deploy}" -n "${NAMESPACE}"

replicas=$(kubectl get deployment "${deploy}" -n "${NAMESPACE}" -o jsonpath='{.status.replicas}')
ready=$(kubectl get deployment "${deploy}" -n "${NAMESPACE}" -o jsonpath='{.status.readyReplicas}')

echo "pods"
kubectl get pods -n "${NAMESPACE}" -l app.kubernetes.io/name=external-dns

pods=$(kubectl get pods -n "${NAMESPACE}" \
  -l app.kubernetes.io/name=external-dns \
  -o jsonpath='{.items[*].metadata.name}')

if [ -z "${pods}" ]; then
  echo "MISSING  external-dns pods"
  echo "done"
  exit 1
fi

for pod in ${pods}; do
  echo "logs ${pod}"
  kubectl logs "${pod}" -n "${NAMESPACE}" --tail=100 || echo "FAILED  logs ${pod}"
done

echo "summary"
echo "deployment ${deploy}"
echo "replicas   ${ready:-0}/${replicas:-0}"
echo "FOUND    deployment ${deploy}"
echo "FOUND    pods (${pods})"

if [ "${ready:-0}" != "0" ] && [ "${ready:-0}" = "${replicas:-0}" ]; then
  echo "FOUND    ready replicas"
else
  echo "MISSING  ready replicas (got ${ready:-0}/${replicas:-0})"
fi

echo "done"
