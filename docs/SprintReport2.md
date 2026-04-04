# Sprint 2 Report (3/2/2026 - 4/4/2026)
## Demo video:


## What's New (User Facing)
* Added Guild functionality
* Added Guild list for swapping between Guilds
* Added Guild channels
* Added channel list for swapping between channels within a Guild
* Changed messages to display top to bottom
* UI overhaul to incorporate the Guild and channel functionality
## Work Summary (Developer Facing)
In order to store an access messages across restarts of the production service, we set up a virtual machine to host
 mongoDB. A surprising number of steps went into this, more so than are ordinarily required to set up mongoDB. We had
 to set up the virtual machine hosting software, set up a VPN to access the mongoDB VM, set up a firewall to sit
 between WAN and mongoDB, and then set up Network Address Traversal because one of our developers had a local IP
 conflict with our virtual network. In addition to this, we opted to use Terraform to manage our infrastructure, so
 multiple experiments needed to be conducted to get that functional and reliable.
 
To complement mongoDB, we decided to create a VM through terraform to manage our production services (unimaginatively
 called the production VM). To make this useful to the development team, we had to set up ssh access, user accounts,
 and a shared local github repo so that anyone can pull updates and start the service. We designed a REST API early to
 parallelize our development process, but found that certain features (like google sign-in) didn't conform to our
 original assumptions.
 
In summary, we created a React front-end to communicate with a Node and Express backend that in turn uses outside
 authentication services and mongoDB to allow near real-time messaging over the internet. Many barriers were faced when
 getting the app to this point, most of which involved trying to get our services to communicate over the internet.
 Since there isn't an easy way to debug packets sent between computers (that do not have packet-sniffing software
 installed), a few of our fixes consisted of tweaking various settings over the course of many hours until something
 works. The most notable examples of this include setting up the Wireguard VPN (Cloudflare not supporting udp proxy,
 WSU blocking wireguard handshakes, and the wireguard client requiring occasional restarts to implement changes all
 resulted in a non-functional VPN with no explanation or debug log.) and receiving responses from the Google OAuth
 platform (The Google Identity services library will silently refuse to POST auth tokens to non-https endpoints, and
 apparently there is a difference between `localhost` and `127.0.0.1` as far as the library is concerned.)

We chose this particular tech stack because it is popular, well established, and our team has almost no experience with
 it. This is our first exposure (with the exception of react) to nearly every technology we have implemented in this
 application, including `proxmox`, `wireguard`, `opnsense`, `terraform`, `Node`, `Express`, `MongoDB`,
 `typescript`, `Json Web Tokens`, and `Google Identity Services`. We hope to showcase more progress for future sprints
 now that we have a basic app and experience with the tech stack, and we hope to integrate more tech in the future.
 We're looking to include `Envoy`, `Docker`, `Kubernetes`, a CI/CD pipeline, and `Ansible` in the upcoming builds.

## Unfinished Work
We completed nearly everything outlined in our WA3 submission for this sprint, with the notable exception of the CI/CD
 pipeline. While in theory, a CI/CD pipeline should be as simple as `clone repo on merge -> Build changed services into
 containers -> upload containers to registry`, issues such as environment variable injection, attempting to debug
 containers, and needing to set up orchestrator/registry/worker VMs mean that we need our infrastructure and software
 to be more seasoned before we can reliably implement the pipeline.

## Completed Issues/User Stories
Here are links to the issues that we completed in this sprint:
* [API: GET /users/{userID}](https://github.com/Inventor4life/Beef/issues/83)
* [API: POST /users](https://github.com/Inventor4life/Beef/issues/85)
* [API: GET /users/me](https://github.com/Inventor4life/Beef/issues/81)
* [API: GET /users/{userID}/short](https://github.com/Inventor4life/Beef/issues/82)
* [Create issues/set up gantt chart for sprint 2](https://github.com/Inventor4life/Beef/issues/72)
* [API: GET /users?oidcSub={oidcSubID}](https://github.com/Inventor4life/Beef/issues/84)
* [guildID and channelID are not padded to 20 characters in guilds.ts](https://github.com/Inventor4life/Beef/issues/94)
* [API: POST /auth](https://github.com/Inventor4life/Beef/issues/80)
* [API: GET /guilds/{guildID}/channels/{channelID}/messages?beforeID={oldest}](https://github.com/Inventor4life/Beef/issues/87)
* [API: GET /guilds/{guildID}](https://github.com/Inventor4life/Beef/issues/86)
* [API: POST /guilds/{guildID}/channels/{channelID}/messages](https://github.com/Inventor4life/Beef/issues/88)
* [frontend: Change message input box location](https://github.com/Inventor4life/Beef/issues/66)
* [User Story: I can receive messages in the channel in real time](https://github.com/Inventor4life/Beef/issues/79)
* [User Story: I can send messages in a channel in real time](https://github.com/Inventor4life/Beef/issues/78)
* [User Story: I can select a channel to view current messages](https://github.com/Inventor4life/Beef/issues/76)
* [User Story: I can select a guild to see available message channels](https://github.com/Inventor4life/Beef/issues/75)
* [User story: view what guilds I am a member of.](https://github.com/Inventor4life/Beef/issues/74)
* [frontend: restrict the number of messages visible on the screen.](https://github.com/Inventor4life/Beef/issues/67)
* [Configure cloudflare WARP Server/clients to allow VPN access from WSU NAT](https://github.com/Inventor4life/Beef/issues/17)

## Incomplete Issues/User Stories
Here are links to issues we worked on but did not complete in this sprint:
* [User Story: I can scroll up to view historical messages in a channel](https://github.com/Inventor4life/Beef/issues/77) - The other frontend user stories were more pertinent to ensure functionality by the sprint 2 deadline.
* [Infrastructure: Create a staging environment](https://github.com/Inventor4life/Beef/issues/68) - This was not necessary for the completion of sprint 2, will be pushed to sprint 3.
* [Update production HTTPS certificate permissions to only be accessible by the deploy user.](https://github.com/Inventor4life/Beef/issues/42) - This was not part of the sprint 2 plan, and thus will be pushed to sprint 3.
* [Configure first-service to start at boot. Research some way to automate it for other services/production machines?](https://github.com/Inventor4life/Beef/issues/28) - This is not necessary for the completion of sprint 2.
* [BUG: Production https certificates point to the prod IP (10.0.0.6) rather than the domain name.](https://github.com/Inventor4life/Beef/issues/101) - A temporary workaround was implemented to resolve this, but a more concrete fix should be initiated in the near future.
* [Modularize terraform](https://github.com/Inventor4life/Beef/issues/69) - It was determined that there was no effective way to accomplish this task without possibly deleting portions of our current configuration of VMs.
* [Research: Local libraries in typescript](https://github.com/Inventor4life/Beef/issues/89) - This was for modularity, not functionality, and thus was not a high priority for this sprint.
* [Add 400 error code documentation for POST /users](https://github.com/Inventor4life/Beef/issues/92) - This is a minor fix which does not heavily impact functionality, so it was considered to be low priority for this sprint.

## Code Files for Review
Please review the following code files, which were actively developed during this
sprint, for quality:
* [main.ts](https://github.com/Inventor4life/Beef/blob/main/services/first-service/src/main.ts)
* [middleware.ts](https://github.com/Inventor4life/Beef/blob/main/services/first-service/src/middleware.ts)
* [messages.ts](https://github.com/Inventor4life/Beef/blob/main/services/first-service/src/messages.ts)
* [db.ts](https://github.com/Inventor4life/Beef/blob/main/services/first-service/src/db.ts)
* [index.html](https://github.com/Inventor4life/Beef/blob/main/services/first-service/data/index.html)
## Retrospective Summary

### Here's what went well:
* We have been able to implement the changes we planned on for this sprint with little time pressure.
* Everyone has managed to do their parts in time.
* Communication was solid, and we were able to meet our sprint 2 goals.
* Backend layout was intuitive for implementing in the frontend.

### Here's what we'd like to improve:
* Better communication across the project, not necessarily longer, but more efficient communication.
* Our UI still has some issues that need to be addressed, like loading text appearing unnecessarily.
* We could look into our archived issues as things to incorporate if we have extra time in the future.
* Code quality.
 
### Here are the changes we plan to implement in the next sprint:
Team-based:
* More effective communication.
* More frequent documentation.
* Dedicate time to UI improvements.
* Cleaning up code.
* Better overall time management.

Technology:
* Add guilds
* Add messaging channels
* Add user sign-in (Store user log in information rather than generating JWTs for anyone who signs in)
* Split our monolithic service into microservices
