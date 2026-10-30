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

manifest_test_mode := "warn"

test_update if {
	input.review.kind.kind == "Namespace"
	input.review.object.metadata.annotations["policy.nuon.co/test-stage"] == "update-1"
}

test_update if {
	input.review.kind.kind == "ConfigMap"
	input.review.object.data.message == "policy-e2e-update-1"
}

# METADATA
# title: Review fixture update
# custom:
#   action: warn
check_review_fixture_update contains check.finding(msg) if {
	manifest_test_mode == "warn"
	test_update
	msg := sprintf("Review the test update to %s %s.", [input.review.kind.kind, input.review.object.metadata.name])
}

# METADATA
# title: Deny fixture update
check_deny_fixture_update contains check.finding(msg) if {
	manifest_test_mode == "deny"
	test_update
	msg := sprintf("The test update to %s %s is denied.", [input.review.kind.kind, input.review.object.metadata.name])
}
