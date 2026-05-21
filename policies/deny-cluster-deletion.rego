package nuon

deny contains msg if {
	resource := input.plan.resource_changes[_]
	resource.type == "aws_eks_cluster"
	resource.change.actions[_] == "delete"
	msg := sprintf("EKS cluster deletion denied: removing '%s' would destroy the sandbox", [resource.address])
}

deny contains msg if {
	resource := input.plan.resource_changes[_]
	resource.type == "aws_eks_cluster"
	resource.change.actions[_] == "delete"
	resource.change.actions[_] == "create"
	msg := sprintf("EKS cluster replace denied: replacing '%s' would cause downtime", [resource.address])
}
