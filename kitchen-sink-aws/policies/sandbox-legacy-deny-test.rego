# Intentional legacy denial: the AWS config currently uses EKS 1.34.
package nuon

deny contains msg if {
	some resource in input.plan.resource_changes
	resource.type == "aws_eks_cluster"
	version := resource.change.after.version
	semver.compare(sprintf("%s.0", [version]), "1.35.0") < 0
	msg := sprintf("[Legacy policy test] EKS cluster %s uses version %s; this test requires 1.35 or newer.", [resource.address, version])
}
