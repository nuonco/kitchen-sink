package nuon

deny contains msg if {
    count(input.metadata.attestations) == 0
    msg := sprintf("Image %s:%s must include attestations", [input.image, input.tag])
}
