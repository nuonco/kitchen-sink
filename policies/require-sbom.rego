package nuon

deny contains msg if {
    not input.metadata.sbom.present
    msg := sprintf("Image %s:%s must include an SBOM", [input.image, input.tag])
}
