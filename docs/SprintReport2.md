# Sprint 2 Report (3/2/2026 - 4/4/2026)
## Demo video:
[https://youtu.be/SeJvwmRrb-E](https://youtu.be/SeJvwmRrb-E)

## What's New (User Facing)
* Added Guild functionality
* Added Guild list for swapping between Guilds
* Added Guild channels
* Added channel list for swapping between channels within a Guild
* Changed messages to display top to bottom
* UI overhaul to incorporate the Guild and channel functionality
## Work Summary (Developer Facing)
After creating our backend in the last sprint, work summary for this sprint is relatively straight forward. This Sprint
 consisted primarily of following the specs outlined in [Sprint2Plan.md](https://github.com/Inventor4life/Beef/blob/main/docs/Sprint2Plan.md)
 to support our new features. We created the endpoints necessary to create users, read/send messages, navigate through
 guilds, and sign in to the service in a semi-secure fashion. On the frontend, we built upon our previous React application
 to utilize the new endpoints. This includes getting an arbitrary number of guilds from the logged-in user, turning
 those guilds into navigable buttons in the left sidebar, and then re-using that guild information to get channels from
 those guilds. Finally, we added a user cache to the front end so that we were not repeatedly querying our backend for
 information that was unlikely to change.
 
In summary, we updated our React front-end to use multiple API endpoints serviced through an Express backend.
 These endpoints allow us to sign in with an authentication service like Google, send and receive messages across 
 multiple guilds and channels, and interface with the backend database to query user and channel information. Many 
 barriers were faced when improving our app, but they were noticeable easier to overcome now that we can build off of the 
 minimum viable product that was delivered last sprint. Challenges for this sprint included certificate validation over
 inter-API calls, traceably logging errors during front- and back-end API calls, and trying to make the UX more
 comfortable to scroll while still adding new user messages.

The tech stack we chose (mainly MERN in addition to a few technologies) is going quite well. We haven't gotten into
 the CI/CD pipeline yet over concerns about local testing and how to handle failed builds, but it is something we would
 like to explore more in the future.

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
* [db.ts](https://github.com/Inventor4life/Beef/blob/main/services/first-service/src/db.ts)
* [index.html](https://github.com/Inventor4life/Beef/blob/main/services/first-service/data/index.html)
* [auth.ts](https://github.com/Inventor4life/Beef/blob/main/services/first-service/src/auth.ts)
* [guilds.ts](https://github.com/Inventor4life/Beef/blob/main/services/first-service/src/guilds.ts)
* [snowflake.ts](https://github.com/Inventor4life/Beef/blob/main/services/first-service/src/snowflake.ts)
* [users.ts](https://github.com/Inventor4life/Beef/blob/main/services/first-service/src/users.ts)

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
* More thorough documentation.
* Better overall time management.
* Have a better idea of issue complexity/ what can be done in a sprint.
* Go over github development practices with team

Technology:
* Add voice channels
* Add the ability to join/leave guilds
* Add guild invite links
* Add private messaging
* Add user name customization
* Add guild administration (Kick, ban, mute)
* Add guild customization (change name, change/rename channels)
* Revamp frontend to be modular
* Remove deprecated endpoints (/messages)
* Potentially receive new messages over WebSockets in addition to the API.
