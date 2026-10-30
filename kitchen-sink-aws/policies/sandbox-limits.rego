package nuon.checks

import data.nuon.lib.check

# METADATA
# title: Require EKS version 1.x
check_eks_version contains check.finding(msg) if {
	resource := input.plan.resource_changes[_]
	resource.type == "aws_eks_cluster"
	version := resource.change.after.version
	not startswith(version, "1.")
	msg := sprintf("EKS cluster version '%s' must be 1.x", [version])
}
