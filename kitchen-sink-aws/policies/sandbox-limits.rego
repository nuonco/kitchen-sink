package nuon

deny contains msg if {
	resource := input.plan.resource_changes[_]
	resource.type == "aws_eks_cluster"
	version := resource.change.after.version
	not startswith(version, "1.")
	msg := sprintf("EKS cluster version '%s' must be 1.x", [version])
}
