package nuon

# The sandbox plan may not add a NAT gateway. This guards the Terraform
# sandbox plan only; the VPC itself comes from the CloudFormation stack.
deny contains msg if {
    resource := input.plan.resource_changes[_]
    resource.type == "aws_nat_gateway"
    resource.change.actions[_] in ["create", "update"]
    msg := sprintf("NAT gateway '%s' is not allowed in this sandbox", [resource.address])
}
