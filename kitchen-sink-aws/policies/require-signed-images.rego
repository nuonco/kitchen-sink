package nuon.checks

import data.nuon.lib.check

# METADATA
# title: Require signed images
check_signed_image contains check.finding(msg) if {
	not input.metadata.signed
	msg := sprintf("Image %s:%s must be signed", [input.image, input.tag])
}
