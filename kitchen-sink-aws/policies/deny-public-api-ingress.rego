package nuon.checks

import data.nuon.lib.check

# METADATA
# title: No public API ingress
check_public_api_ingress contains check.finding(msg) if {
	input.review.kind.kind == "Ingress"
	input.review.object.metadata.name == "kitchen-sink-api-public"
	msg := "API ingress must not be publicly accessible. Use internal ingress only."
}

# METADATA
# title: Require the internal API ingress class
check_api_ingress_class contains check.finding(msg) if {
	input.review.kind.kind == "Ingress"
	contains(input.review.object.metadata.name, "kitchen-sink-api")
	annotations := input.review.object.metadata.annotations
	not annotations["kubernetes.io/ingress.class"] == "internal-nginx"
	contains(input.review.object.metadata.name, "kitchen-sink-api")
	msg := "API ingress must use internal-nginx ingress class."
}
