package nuon

deny contains msg if {
    resource := input.plan.resource_changes[_]
    "delete" in resource.change.actions
    msg := sprintf("'%s' would be destroyed by this update", [resource.address])
}
