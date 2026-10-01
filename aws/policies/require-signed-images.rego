package nuon

deny contains msg if {
    not input.metadata.signed
    msg := sprintf("Image %s:%s must be signed", [input.image, input.tag])
}
