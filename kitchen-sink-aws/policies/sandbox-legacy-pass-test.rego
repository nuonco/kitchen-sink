# Legacy compatibility test: the configured EKS 1.34 version should pass.
package nuon

deny contains msg if {
	some resource in input.plan.resource_changes
	resource.type == "aws_eks_cluster"
	version := resource.change.after.version
	not startswith(version, "1.")
	msg := sprintf("[Legacy policy test] EKS cluster %s uses version %s; expected 1.x.", [resource.address, version])
}
