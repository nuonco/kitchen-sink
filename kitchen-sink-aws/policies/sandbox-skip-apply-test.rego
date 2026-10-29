package nuon.checks

import data.nuon.lib.check

# METADATA
# title: Defer sandbox EKS changes
# description: Baseline control; allow the configured EKS 1.34 sandbox to apply.
# custom:
#   action: skip_apply
check_defer_eks_changes contains check.finding(msg) if {
	some resource in input.plan.resource_changes
	resource.type == "aws_eks_cluster"
	version := resource.change.after.version
	semver.compare(sprintf("%s.0", [version]), "1.34.0") < 0
	msg := sprintf("Sandbox apply deferred for EKS cluster %s at version %s.", [resource.address, version])
}
