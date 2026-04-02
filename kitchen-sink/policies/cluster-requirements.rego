package nuon

deny contains msg if {
	namespace := input.review.object.metadata.namespace
	namespace == "kube-system"
	input.review.kind.kind == "Deployment"
	msg := "Cannot deploy custom workloads to kube-system namespace"
}
