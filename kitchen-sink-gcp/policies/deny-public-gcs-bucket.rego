package nuon

public_member(member) if {
	member == "allUsers"
}

public_member(member) if {
	member == "allAuthenticatedUsers"
}

deny contains msg if {
	resource := input.plan.resource_changes[_]
	resource.type == "google_storage_bucket_iam_member"
	resource.change.actions[_] in ["create", "update"]
	member := resource.change.after.member
	public_member(member)
	msg := sprintf("GCS IAM resource '%s' must not grant public access", [resource.address])
}

deny contains msg if {
	resource := input.plan.resource_changes[_]
	resource.type == "google_storage_bucket_iam_binding"
	resource.change.actions[_] in ["create", "update"]
	member := resource.change.after.members[_]
	public_member(member)
	msg := sprintf("GCS IAM resource '%s' must not grant public access", [resource.address])
}

deny contains msg if {
	resource := input.plan.resource_changes[_]
	resource.type == "google_storage_bucket_iam_policy"
	resource.change.actions[_] in ["create", "update"]
	policy := resource.change.after.policy_data
	contains(policy, "allUsers")
	msg := sprintf("GCS IAM resource '%s' must not grant public access", [resource.address])
}

deny contains msg if {
	resource := input.plan.resource_changes[_]
	resource.type == "google_storage_bucket_iam_policy"
	resource.change.actions[_] in ["create", "update"]
	policy := resource.change.after.policy_data
	contains(policy, "allAuthenticatedUsers")
	msg := sprintf("GCS IAM resource '%s' must not grant public access", [resource.address])
}

deny contains msg if {
	resource := input.plan.resource_changes[_]
	resource.type == "google_storage_bucket"
	resource.change.actions[_] in ["create", "update"]
	resource.change.after.public_access_prevention != "enforced"
	msg := sprintf("GCS bucket '%s' must enforce public access prevention", [resource.address])
}
