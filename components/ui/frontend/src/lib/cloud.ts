import type { UIConfig } from './api'

export type Cloud = 'aws' | 'gcp'

export const cloudDetails = {
  aws: {
    cluster: 'EKS',
    lb: 'ALB',
    account: 'AWS account',
    identityCmd: 'aws sts get-caller-identity',
    registry: 'public.ecr.aws/p7e3r5y0',
    pulumiKey: 'aws:region',
    sandbox: 'aws-eks-sandbox',
    storage: 'S3',
    certificate: 'ACM',
  },
  gcp: {
    cluster: 'GKE',
    lb: 'GCLB (Gateway)',
    account: 'GCP project',
    identityCmd: 'gcloud auth list',
    registry: 'us-west1-docker.pkg.dev/nuon-public/kitchen-sink',
    pulumiKey: 'gcp:project',
    sandbox: 'gcp-gke-sandbox',
    storage: 'GCS',
    certificate: 'Certificate Manager',
  },
} as const

export function cloudOf(config: UIConfig): Cloud {
  return config.cloud === 'gcp' ? 'gcp' : 'aws'
}

export function detailsFor(config: UIConfig) {
  return cloudDetails[cloudOf(config)]
}
