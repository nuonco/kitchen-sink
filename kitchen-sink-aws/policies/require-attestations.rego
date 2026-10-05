package nuon

warn contains msg if {
    count(input.metadata.attestations) == 0
    msg := sprintf("Image %s:%s should include attestations", [input.image, input.tag])
}
