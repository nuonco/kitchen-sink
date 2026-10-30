# METADATA
# custom:
#   action: warn
package nuon.checks

import data.nuon.lib.check

# METADATA
# title: Recommend image attestations
check_attestations contains check.finding(msg) if {
	count(input.metadata.attestations) == 0
	msg := sprintf("Image %s:%s should include attestations", [input.image, input.tag])
}
