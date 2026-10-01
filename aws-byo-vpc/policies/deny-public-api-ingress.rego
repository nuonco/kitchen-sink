package nuon

deny contains msg if {
    input.review.kind.kind == "Ingress"
    input.review.object.metadata.name == "kitchen-sink-api-public"
    msg := "API ingress must not be publicly accessible. Use internal ingress only."
}

deny contains msg if {
    input.review.kind.kind == "Ingress"
    contains(input.review.object.metadata.name, "kitchen-sink-api")
    annotations := input.review.object.metadata.annotations
    not annotations["kubernetes.io/ingress.class"] == "internal-nginx"
    contains(input.review.object.metadata.name, "kitchen-sink-api")
    msg := "API ingress must use internal-nginx ingress class."
}
