package nuon

warn contains msg if {
	input.review.kind.kind == "Deployment"
	input.review.object.spec.replicas < 2
	name := input.review.object.metadata.name
	msg := sprintf("Deployment '%s' has fewer than 2 replicas; consider running at least 2 for availability", [name])
}
