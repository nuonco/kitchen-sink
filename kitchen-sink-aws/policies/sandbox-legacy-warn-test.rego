# Intentional legacy warning, using the supported object-shaped message format.
package nuon

warn contains {"msg": msg} if {
	some resource in input.plan.resource_changes
	resource.type == "aws_eks_node_group"
	some instance_type in resource.change.after.instance_types
	startswith(instance_type, "t3")
	msg := sprintf("[Legacy policy test] EKS node group %s uses burstable instance type %s; use a non-burstable type to clear this warning.", [resource.address, instance_type])
}
