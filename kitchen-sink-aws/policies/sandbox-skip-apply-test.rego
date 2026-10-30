package nuon.checks

import data.nuon.lib.check

# METADATA
# title: Defer sandbox log retention update
# description: Exercise skip_apply on an in-place update without changing the deployed sandbox.
# custom:
#   action: skip_apply
check_defer_log_retention contains check.finding(msg) if {
	some resource in input.plan.resource_changes
	resource.type == "aws_cloudwatch_log_group"
	"update" in resource.change.actions
	resource.change.after.retention_in_days == 400
	msg := sprintf("Sandbox log retention update to 400 days is deferred for %s.", [resource.address])
}
