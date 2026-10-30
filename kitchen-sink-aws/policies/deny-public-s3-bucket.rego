package nuon.checks

import data.nuon.lib.check

# METADATA
# title: Block public S3 ACLs
check_public_acls contains check.finding(msg) if {
	resource := input.plan.resource_changes[_]
	resource.type == "aws_s3_bucket_public_access_block"
	resource.change.actions[_] in ["create", "update"]
	resource.change.after.block_public_acls == false
	msg := sprintf("S3 bucket '%s' must not allow public access", [resource.address])
}

# METADATA
# title: Block public S3 policies
check_public_policy contains check.finding(msg) if {
	resource := input.plan.resource_changes[_]
	resource.type == "aws_s3_bucket_public_access_block"
	resource.change.actions[_] in ["create", "update"]
	resource.change.after.block_public_policy == false
	msg := sprintf("S3 bucket '%s' must block public policy", [resource.address])
}
