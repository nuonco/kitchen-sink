module "repo" {
  source = "./ecr"

  name = "${var.install_id}-kitchen-sink"
  tags = {}

  region = var.region
}
