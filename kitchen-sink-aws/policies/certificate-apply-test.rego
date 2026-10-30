package nuon.checks

import data.nuon.lib.check

certificate_test_mode := "warn-skip"

# METADATA
# title: Defer certificate tag update
# custom:
#   action: skip_apply
check_defer_certificate_tag contains check.finding(msg) if {
	certificate_test_mode in {"skip", "warn-skip", "deny-skip"}
	some resource in input.plan.resource_changes
	resource.type == "aws_acm_certificate"
	"update" in resource.change.actions
	resource.change.after.tags["policy.nuon.co/test-stage"] == "update-1"
	msg := sprintf("Certificate tag update is deferred for %s.", [resource.address])
}

# METADATA
# title: Hold certificate mutation
# description: A second finding must not count as a second skipped component apply.
# custom:
#   action: skip_apply
check_hold_certificate_mutation contains check.finding(msg) if {
	certificate_test_mode in {"skip", "warn-skip", "deny-skip"}
	some resource in input.plan.resource_changes
	resource.type == "aws_acm_certificate"
	"update" in resource.change.actions
	msg := sprintf("Certificate changes are on hold for %s.", [resource.address])
}

# METADATA
# title: Review certificate tag change
# custom:
#   action: warn
check_review_certificate_tag contains check.finding(msg) if {
	certificate_test_mode == "warn-skip"
	some resource in input.plan.resource_changes
	resource.type == "aws_acm_certificate"
	"update" in resource.change.actions
	msg := sprintf("Review the certificate tag change for %s.", [resource.address])
}

# METADATA
# title: Deny certificate tag change
check_deny_certificate_tag contains check.finding(msg) if {
	certificate_test_mode == "deny-skip"
	some resource in input.plan.resource_changes
	resource.type == "aws_acm_certificate"
	"update" in resource.change.actions
	msg := sprintf("Certificate tag changes are denied for %s.", [resource.address])
}
