terraform {
  required_providers {
     proxmox = {
      source = "bpg/proxmox"
      version = "0.95.1-rc1"
    }
  }
}

provider "proxmox" {
  insecure = true # Temporary while we bootstrap the system. Remove once a CA is created.
  endpoint = vars.virtual_environment_endpoint
  username = vars.virtual_environment_username
  password = vars.virtual_environment_password
}
