package nuon.checks

import data.nuon.lib.check

# METADATA
# title: Defer sandbox EKS changes
# description: Dogfood skipping sandbox apply while the desired EKS version is below 1.35.
# custom:
#   action: skip_apply
check_defer_eks_changes contains check.finding(msg) if {
	some resource in input.plan.resource_changes
	resource.type == "aws_eks_cluster"
	version := resource.change.after.version
	semver.compare(sprintf("%s.0", [version]), "1.35.0") < 0
	msg := sprintf("Sandbox apply deferred for EKS cluster %s at version %s.", [resource.address, version])
}
