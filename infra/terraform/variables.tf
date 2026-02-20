variable "virtual_environment_endpoint" {
  type        = string
  description = "Terraform's proxmox management endpoint"
  sensitive   = true
}

variable "virtual_environment_username" {
  type        = string
  description = "Username for terraform's proxmox management account"
  sensitive   = true
}

variable "virtual_environment_password" {
  type        = string
  description = "Password for terraform's proxmox management account"
  sensitive   = true
}

variable "wg_host_default_username" {
  type        = string
  description = "The default account username for the wireguard host"
  sensitive   = true
}
