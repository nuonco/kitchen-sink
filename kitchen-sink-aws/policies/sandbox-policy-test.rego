# Intentional test constraints: the AWS config currently uses EKS 1.34 and t3a.medium.
# Inspect desired state, including no-op resources, so existing sandboxes also match.
package nuon.checks

import data.nuon.lib.check

# METADATA
# title: Test — require EKS 1.34 or newer
# description: Allows the configured EKS 1.34 version so skip_apply can be exercised.
check_eks_version contains check.finding(msg) if {
	some resource in input.plan.resource_changes
	resource.type == "aws_eks_cluster"
	version := resource.change.after.version
	semver.compare(sprintf("%s.0", [version]), "1.34.0") < 0
	msg := sprintf(
		"[Policy test] EKS cluster %s uses version %s; this test requires 1.34 or newer.",
		[resource.address, version],
	)
}

# METADATA
# title: Test — avoid burstable EKS nodes
# description: Intentionally warns on the configured t3a.medium node type.
# custom:
#   action: warn
check_burstable_nodes contains check.finding(msg) if {
	some resource in input.plan.resource_changes
	resource.type == "aws_eks_node_group"
	some instance_type in resource.change.after.instance_types
	startswith(instance_type, "t3")
	msg := sprintf(
		"[Policy test] EKS node group %s uses burstable instance type %s; use a non-burstable type to clear this warning.",
		[resource.address, instance_type],
	)
}
