default_instance_type = "t3a.medium"

# Grant the maintenance role cluster-scoped Kubernetes access. Component deploys
# run as the maintenance role (the deploy->setup mapping falls back to it, since
# the sandbox module creates no access entry for the custom "setup" role). The
# default maintenance ClusterRole grants namespaced roles/rolebindings but NOT
# cluster-scoped clusterroles/clusterrolebindings, so deploying the chart's
# ClusterRole ("conduit-cluster-role") is denied. Associating the
# cluster-admin access policy with the maintenance access entry grants the
# cluster-scoped RBAC needed to manage ClusterRole/ClusterRoleBinding resources.
maintenance_role_eks_access_entry_policy_associations = {
  cluster_admin = {
    policy_arn = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"
    access_scope = {
      type       = "cluster"
      namespaces = []
    }
  }
}
