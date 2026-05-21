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

deny contains msg if {
	resource := input.plan.resource_changes[_]
	resource.type in ["aws_s3_bucket", "aws_s3_object"]
	resource.change.actions[_] in ["create", "update"]
	tags := resource.change.after.tags
	tags["public"] == "true"
	msg := sprintf("Resource '%s' must not have the 'public' tag set to 'true'", [resource.address])
}

deny contains msg if {
	resource := input.plan.resource_changes[_]
	resource.type in ["aws_s3_bucket", "aws_s3_object"]
	resource.change.actions[_] in ["create", "update"]
	tags := resource.change.after.tags_all
	tags["public"] == "true"
	msg := sprintf("Resource '%s' must not have the 'public' tag (inherited) set to 'true'", [resource.address])
}
