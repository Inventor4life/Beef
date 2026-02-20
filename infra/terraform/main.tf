# steps followed from 
# https://registry.terraform.io/providers/bpg/proxmox/latest/docs/guides/clone-vm

# TODO: Modularize this file once we can confirm that it works.

terraform {
  required_providers {
    proxmox = {
      source = "bpg/proxmox"
      version = "0.96.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "2.7.0"
    }
  }
}

provider "proxmox" {
  insecure = true # Temporary while we bootstrap the system. Remove once a CA is created.
  endpoint = var.virtual_environment_endpoint
  username = var.virtual_environment_username
  password = var.virtual_environment_password
}

data "local_file" "wg_public_key" {
  filename = "./wg_ed25519.pub"
}

resource "proxmox_virtual_environment_file" "wg_user_data_cloud_config" {
  content_type = "snippets"
  datastore_id = "local"
  node_name    = "minic"

  source_raw {
    data = <<-EOF
    #cloud-config
    hostname: wg-host
    timezone: America/Toronto
    users:
      - name: ${var.wg_host_default_username}
        groups:
          - sudo
        shell: /bin/bash
        ssh_authorized_keys:
          - ${trimspace(data.local_file.wg_public_key.content)}
        sudo: ALL=(ALL) NOPASSWD:ALL
    package_update: true
    packages:
      - qemu-guest-agent
      - net-tools
      - curl
    runcmd:
      - systemctl enable qemu-guest-agent
      - systemctl start qemu-guest-agent
      - echo "done" > /tmp/cloud-config.done
    EOF

    file_name = "user-data-cloud-config.yaml"
  }
}

resource "proxmox_virtual_environment_vm" "wg_host" {
  name        = "wg-host"
  description = "Wireguard host, managed by terraform"
  tags        = ["terraform", "ubuntu"]
  
  node_name = "minic"
  vm_id     = 104
  
  clone {
    vm_id = 9000 # Non-terraform-managed ubuntu cloud image
  }
  
  agent {
    enabled = true
  }
  
  memory {
    dedicated = 4096 # MB
  }
  
  initialization {
  
    ip_config {
      ipv4 {
        address = "10.0.0.4/16"
        gateway = "10.0.0.1"
      }
    }
    
    user_data_file_id = proxmox_virtual_environment_file.wg_user_data_cloud_config.id
  }
  
  disk {
    interface = "scsi1"
    size = 4
  }
  
  lifecycle {
    prevent_destroy = true
  }
}
