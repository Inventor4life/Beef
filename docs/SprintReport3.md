# Sprint 3 Report (4/5/2026 - 4/25/2026)
## Demo video:
TBD

## What's New (User Facing)
* A doneness selector, displaying from rare to well done, sets the theme of the UI.
* Voice Chat: The members of the voice channel you are currently in are displayed directly above whatever text channel you are in.
* Invites, guilds have invite codes, and in the guild sidebar, there is a section to paste an invite code and hit accept to join that guild.

## Work Summary (Developer Facing)
The bulk of this sprint was spent expanding the API surface and adding the supporting frontend functionality
 outlined in [Sprint3Plan.md](https://github.com/Inventor4life/Beef/blob/main/docs/Sprint3Plan.md). On the backend,
 we added scope middleware (`requireScope`) so that endpoints can distinguish between regular
 user tokens and internal service tokens, then modified the existing endpoints to require specific scope.
 We also added enforcement of guild membership on endpoints (like you cannot read messages in a
 guild you are not a member of). As for new endpoints, we added `POST /guilds`, `POST /guilds/{guildID}/channels`,
 `POST /guilds/{guildID}/members`, `POST /users/{userID}/guildMemberships`, the `/invites` collection and its three
 endpoints, and the `POST /guilds/{guildID}/channels/{channelID}/token` endpoint that issues short-lived channel
 tokens for the WebSocket interfaces. We also deleted `/messages` and `/test-auth` endpoints and
 moved the index page from `/auth` to `/`.

The largest feature for this sprint was voice channels. After Ethan built two voice experiments
 (`experiments/conference-voice` and `experiments/mediasoup-voice`), we decided on the mediasoup approach 
 and ported it into the production service as `voice-server.ts`, alongside a packaged client library (`voice-client.ts`). 
 The voice server runs over the same HTTPS server as the rest of the API, mounted at `/voice`, and authenticates connections 
 with the new channel tokens. On the frontend, we added the voice client integration so that users can join a voice channel, 
 hear other members, and see who is currently in the channel.

As for other frontend changes, a lot was done on the main page to support the new features. We added create-guild and
 create-channel buttons, an invite-link button on each guild, a `#/invites/{inviteCode}` route that resolves an invite 
 to a guild and lets the user accept it, channel-type icons that distinguish text and voice channels, and the historical-message 
 scroll-up loader that was carried over from sprint 2. We also gave the page a theme system (how well you want your steak cooked),
 and a favicon.

Operationally, we cleaned up a couple of long-standing rough edges. We pulled environment loading into a dedicated
 `env.ts` module so that `dotenv` is initialized exactly once before any other module reads `process.env`, and we
 added a `HOST` environment variable so the service can be run on developer machines whose IPs do not match the
 hard-coded production address. We also added a `npm start` script and added default channel type so that 
 older guilds still render correctly in the new UI.

## Unfinished Work
TBD

## Completed Issues/User Stories
TBD

## Incomplete Issues/User Stories
Here are links to issues we worked on but did not complete in this sprint:
* [Infrastructure: Create a staging environment](https://github.com/Inventor4life/Beef/issues/68) - Carried over from
 sprint 2. Still not strictly required to ship sprint 3 features, so it was deprioritized in favor of other work.
* [Modularize terraform](https://github.com/Inventor4life/Beef/issues/69) - Carried over from sprint 2. We still
 have not found a way to refactor our terraform configuration without risking the total destruction of our current
 VMs. Also not really a priority since there was other more pressing issues/features to deal with.
* [Research: Local libraries in typescript](https://github.com/Inventor4life/Beef/issues/89) - Carried over from
 sprint 2. We picked up some incidental experience packaging the voice client as a standalone library, but did not
 do the focused research/experiment.
* [BUG: Production https certificates point to the prod IP (10.0.0.6) rather than the domain name.](https://github.com/Inventor4life/Beef/issues/101) -
 The temporary workaround from sprint 2 is still in place. A proper fix requires regenerating the certs against a
 real domain name, which we did not get to this sprint.
* [Update production HTTPS certificate permissions to only be accessible by the deploy user.](https://github.com/Inventor4life/Beef/issues/42) -
 Not part of the sprint 3 plan but remains open as a security TODO.
* [Configure first-service to start at boot. Research some way to automate it for other services/production machines?](https://github.com/Inventor4life/Beef/issues/28) -
 The production service is still started manually via `./server-start.sh`. Restarts are infrequent enough that this has not been a practical problem yet, so it was once
 again not prioritized.
* Live-messaging WebSocket (`/live`) - Note that this was not an official issue, but the plan called for a WebSocket-based 
 push channel for new messages so that polling could be removed. The voice WebSocket interface was the primary priority for 
 this sprint, so the chat page is still polling once per second for new messages. Should be revisited.
* User name customization (`POST /users/me/friendlyName` + Profile UI) - Once again not an official issue, but the plan included 
 an endpoint and a frontend Profile panel that would let users rename themselves. This is not integral to core functionality
 and would be more difficult than it seems since channel lists would also have to be updated, but should be a feature in
 future work.

## Code Files for Review
Please review the following code files, which were actively developed during this
sprint, for quality:
* [main.ts](https://github.com/Inventor4life/Beef/blob/main/services/first-service/src/main.ts)
* [middleware.ts](https://github.com/Inventor4life/Beef/blob/main/services/first-service/src/middleware.ts)
* [auth.ts](https://github.com/Inventor4life/Beef/blob/main/services/first-service/src/auth.ts)
* [env.ts](https://github.com/Inventor4life/Beef/blob/main/services/first-service/src/env.ts)
* [guilds.ts](https://github.com/Inventor4life/Beef/blob/main/services/first-service/src/guilds.ts)
* [invites.ts](https://github.com/Inventor4life/Beef/blob/main/services/first-service/src/invites.ts)
* [users.ts](https://github.com/Inventor4life/Beef/blob/main/services/first-service/src/users.ts)
* [voice-server.ts](https://github.com/Inventor4life/Beef/blob/main/services/first-service/src/voice-server.ts)
* [voice-client.ts](https://github.com/Inventor4life/Beef/blob/main/services/first-service/src/voice-client.ts)
* [index.html](https://github.com/Inventor4life/Beef/blob/main/services/first-service/data/index.html)

## Retrospective Summary
Here's what went well:
* Our team worked together seamlessly, the back-end implementing endpoints that were easily integrated into the front-end.
* We met a little less than twice a week, which helped us keep to our deadlines better.
* We delegated weekly tasks to clarify what each team member's job was.
Here's what we'd like to improve:
* Code clarity: our code could be more efficient, dynamic, and clear. It would help speed up review time.
* Coding speed/time constraint, we had to scrap several features for this sprint because they were simply not possible to do in the remaining time. If we had more time, we could have delivered on several additional features.
* More thorough testing. We had issues on the day of the presentation; we managed to resolve them, but more thorough testing likely could have prevented the uncertainty.
Here are the changes we plan to implement in the next sprint:
* There is no other sprint, but I will act as though there is.
* We will assign testing tasks; we merely assigned the creation of features, but having additional testing as a dedicated task will help us discover and solve issues.
* We will review the code and restructure our software to be microservices-based, rather than monolithic.
