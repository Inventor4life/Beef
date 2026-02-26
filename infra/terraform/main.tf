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
  username = "${var.virtual_environment_username}@pve"
  password = var.virtual_environment_password
  
  ssh {
    agent       = false
    username    = var.virtual_environment_username
    
    # fileexists to suppress terraform validate missing file warnings
    private_key = fileexists("~/.ssh/pve/pve_ed25519") ? file("~/.ssh/pve/pve_ed25519") : "default" 
  }
}

#
# BEGIN wireguard vm CONFIGURATION
#

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

#
# END wireguard CONFIGURATION
#

#
# BEGIN database CONFIGURATION
#

data "local_file" "db_public_key" {
  filename = "./db_ed25519.pub"
}

resource "proxmox_virtual_environment_file" "db_user_data_cloud_config" {
  content_type = "snippets"
  datastore_id = "local"
  node_name    = "minic"

  source_raw {
    data = <<-EOF
    #cloud-config
    hostname: db-host
    timezone: America/Los_Angeles
    users:
      - name: ${var.db_host_default_username}
        groups:
          - sudo
        shell: /bin/bash
        ssh_authorized_keys:
          - ${trimspace(data.local_file.db_public_key.content)}
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

    file_name = "db-user-data-cloud-config.yaml"
  }
}

resource "proxmox_virtual_environment_vm" "db_host" {
  name        = "db-host"
  description = "Database host, managed by terraform"
  tags        = ["terraform", "ubuntu", "database"]
  migrate     = true
  
  node_name = "minic"
  vm_id     = 105
  
  clone {
    vm_id = 9000 # Non-terraform-managed ubuntu cloud image
  }
  
  agent {
    enabled = true
  }
  
  memory {
    dedicated = 2048 # MB
    floating  = 2048 # MB
  }
  
  initialization {
  
    ip_config {
      ipv4 {
        address = "10.0.0.5/16"
        gateway = "10.0.0.1"
      }
    }
    
    user_data_file_id = proxmox_virtual_environment_file.db_user_data_cloud_config.id
  }
  
  disk {
    interface = "scsi1"
    size = 16
  }
  
  lifecycle {
    prevent_destroy = true
  }
}

#
# END database CONFIGURATION
#

#
# BEGIN production CONFIGURATION
#

resource "proxmox_virtual_environment_file" "prod_cloud_config" {
  content_type = "snippets"
  datastore_id = "local"
  node_name    = "minic"

  source_raw {
    data = <<-EOF
    #cloud-config
    hostname: prod
    timezone: America/Los_Angeles
    users:
      - name: ${var.dev1_username}
        groups:
          - sudo
        shell: /bin/bash
        ssh_authorized_keys:
          - ${trimspace(fileexists("~/Beef/infra/terraform/dev1_ed25519.pub") ? file("~/Beef/infra/terraform/dev1_ed25519.pub") : "default")}
        sudo: ALL=(ALL) NOPASSWD:ALL
      - name: ${var.dev2_username}
        groups:
          - sudo
        shell: /bin/bash
        ssh_authorized_keys:
          - ${trimspace(fileexists("~/Beef/infra/terraform/dev2_ed25519.pub") ? file("~/Beef/infra/terraform/dev2_ed25519.pub") : "default")}
        sudo: ALL=(ALL) NOPASSWD:ALL
      - name: ${var.dev3_username}
        groups:
          - sudo
        shell: /bin/bash
        ssh_authorized_keys:
          - ${trimspace(fileexists("~/Beef/infra/terraform/dev3_ed25519.pub") ? file("~/Beef/infra/terraform/dev3_ed25519.pub") : "default")}
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

    file_name = "db-user-data-cloud-config.yaml"
  }
}

resource "proxmox_virtual_environment_vm" "prod" {
  name        = "prod"
  description = "Production VM, managed by terraform"
  tags        = ["terraform", "ubuntu", "production"]
  migrate     = true
  
  node_name = "minic"
  vm_id     = 106
  
  clone {
    vm_id = 9000 # Non-terraform-managed ubuntu cloud image
  }
  
  agent {
    enabled = true
  }
  
  memory {
    dedicated = 2048 # MB
    floating  = 2048 # MB
  }
  
  initialization {
  
    ip_config {
      ipv4 {
        address = "10.0.0.6/16"
        gateway = "10.0.0.1"
      }
    }
    
    user_data_file_id = proxmox_virtual_environment_file.prod_cloud_config.id
  }
  
  disk {
    interface = "scsi1"
    size = 16
  }
  
  lifecycle {
    prevent_destroy = true
  }
}

#
# END production CONFIGURATION
#
