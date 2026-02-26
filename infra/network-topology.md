## Introduction
This document contains networking information for Beef infrastructure, including hosts, subnet allocations, gateways, etc.

## Gateway

The network gateway has an address of `10.0.0.1` and is located on the host `Minic`

## Subnets
The following subnets are allocated:
```
Hosts: 10.0.0.0/16
VPN Clients: 10.1.0.0/24
Hosts-redirect: 10.2.0.0/16
```
One of our developers had an IP conflict with the `10.0.0.0/16` subnet. A BINAT has been set up to translate `10.2.x.y <-> 10.0.x.y`.

## IP address allocation:
Outside of the VPN Client subnet, IP addresses are allocated with the following system:

```
10.0.x.y
x -> physical host number
y -> VM number

with 10.0.x.1 reserved for gateways (if any)
and  10.0.x.2 reserved for physical host access

Example: If strg1 had only a database VM,
 it would be given the IP 10.0.5.3
```

## Hosts
The following hosts are present on the network. These are the internal names used and do not represent the hardware they are running on.
```
0. Minic: 10.0.0.0/24
1. Opti1: unassigned
2. Opti2: unassigned
3. Opti3: unassigned
4. Opti4: unassigned
5. Strg1: unassigned
6. RPi1:  unassigned
```

## VMs
The following VMs are present (with description), listed by host:
### Minic
```
10.0.0.1: Opnsense     - Firewall, wireguard
10.0.0.3: Inframanager - Terraform host
10.0.0.4: wg-host      - (in development) Cloudflare tunnel host
10.0.0.5: mongodb      - (in development) future database host
10.0.0.6: production   - (in development) production website
```

## VPN Clients
These are the clients that currently have access to the network:
```
wg0 (host):  10.1.0.1/32
i4l-laptop:  10.1.0.2/32
i4l-phone:   10.1.0.3/32
i4l-desktop: 10.1.0.4/32
cole-laptop: 10.1.0.5/32
ben-laptop:  10.1.0.6/32
```

## Domain information

The domain `goodecodes.com/beef` will be used for this project. This may change as the project matures.
