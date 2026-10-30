package nuon.checks

import data.nuon.lib.check

# METADATA
# title: Require image attestations
check_attestations contains check.finding(msg) if {
	count(input.metadata.attestations) == 0
	msg := sprintf("Image %s:%s must include attestations", [input.image, input.tag])
}
