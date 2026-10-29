package nuon.checks

import data.nuon.lib.check

# METADATA
# title: Protect the kube-system namespace
check_system_namespace contains check.finding(msg) if {
	namespace := input.review.object.metadata.namespace
	namespace == "kube-system"
	input.review.kind.kind == "Deployment"
	msg := "Cannot deploy custom workloads to kube-system namespace"
}
