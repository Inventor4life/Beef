variable "virtual_environment_endpoint" {
  type        = string
  description = "Terraform's proxmox management endpoint"
  sensitive   = true
}

variable "virtual_environment_username" {
  type        = string
  description = "Username for terraform's proxmox management account, excluding realm"
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

variable "db_host_default_username" {
  type        = string
  description = "The default account username for our mongodb host"
  sensitive   = true
}

variable "dev1_username" {
  type        = string
  description = "preferred login username of Inventor4life"
  sensitive   = true
}

variable "dev2_username" {
  type        = string
  description = "preferred login username of redstonejazz5-source"
  sensitive   = true
}

variable "dev3_username" {
  type        = string
  description = "preferred login username of Cole-Godfrey"
  sensitive   = true
}
