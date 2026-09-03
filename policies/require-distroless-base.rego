package nuon

approved_distroless_digests := {
    "afa5c872c891853ca7fcf1f12c3edb23f7eeef36189728842dd51042ff57f7ab",
    "52dcfbabb7457ea47c82f6e13af8c8a4a1d9f7b0145142b3ecab20f2b888411d",
}

provenance_dependencies contains dependency if {
    some manifest in input.metadata.attestation_manifests
    some layer in manifest.layers
    contains(layer.predicate_type, "https://slsa.dev/provenance")
    not layer.truncated
    some dependency in layer.decoded.predicate.materials
}

provenance_dependencies contains dependency if {
    some manifest in input.metadata.attestation_manifests
    some layer in manifest.layers
    layer.predicate_type == "https://slsa.dev/provenance/v1"
    not layer.truncated
    some dependency in layer.decoded.predicate.buildDefinition.resolvedDependencies
}

has_approved_distroless_base if {
    some dependency in provenance_dependencies
    contains(dependency.uri, "gcr.io/distroless/static-debian12")
    some digest in approved_distroless_digests
    dependency.digest.sha256 == digest
}

has_approved_distroless_base if {
    some dependency in provenance_dependencies
    contains(dependency.uri, "gcr.io/distroless/static-debian12")
    some digest in approved_distroless_digests
    contains(dependency.uri, digest)
}

deny contains msg if {
    not has_approved_distroless_base
    msg := sprintf("Image %s:%s provenance must declare an approved distroless base image", [input.image, input.tag])
}
