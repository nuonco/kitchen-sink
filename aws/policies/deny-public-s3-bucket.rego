package nuon

deny contains msg if {
    resource := input.plan.resource_changes[_]
    resource.type == "aws_s3_bucket_public_access_block"
    resource.change.actions[_] in ["create", "update"]
    resource.change.after.block_public_acls == false
    msg := sprintf("S3 bucket '%s' must not allow public access", [resource.address])
}

deny contains msg if {
    resource := input.plan.resource_changes[_]
    resource.type == "aws_s3_bucket_public_access_block"
    resource.change.actions[_] in ["create", "update"]
    resource.change.after.block_public_policy == false
    msg := sprintf("S3 bucket '%s' must block public policy", [resource.address])
}
