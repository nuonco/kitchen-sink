variable "region" {
  type = string
}

variable "install_id" {
  type = string
}

variable "domain_name" {
  type = string
}

variable "zone_id" {
  type = string
}

variable "policy_test_stage" {
  type    = string
  default = "baseline"
}
