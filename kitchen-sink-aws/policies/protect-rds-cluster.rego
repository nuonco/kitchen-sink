package nuon

rds_types := {"aws_rds_cluster", "aws_rds_cluster_instance", "aws_db_instance"}

deny contains msg if {
    resource := input.plan.resource_changes[_]
    resource.type in rds_types
    "delete" in resource.change.actions
    msg := sprintf("RDS resource '%s' cannot be deleted outside of a teardown", [resource.address])
}
