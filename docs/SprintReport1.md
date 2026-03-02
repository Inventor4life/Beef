# Sprint 1 Report (2/23/2026 - 3/1/2026)
## What's New (User Facing)
* The MVP is Live (on our VPN)!
* You can log in with Google
* You can send basic messages
* You can view messages sent by you and other users
## Work Summary (Developer Facing)
Provide a one paragraph synposis of what your team accomplished this sprint. Don't
repeat the "What's New" list of features. Instead, help the instructor understand
how you went about the work described there, any barriers you overcame, and any
significant learnings for your team.
## Unfinished Work
If applicable, explain the work you did not finish in this sprint. For issues/user
stories in the current sprint that have not been closed, (a) any progress toward
completion of the issues has been clearly tracked (by checking the checkboxes of
acceptance criteria), (b) a comment has been added to the issue to explain why the
issue could not be completed (e.g., "we ran out of time" or "we did not anticipate
it would be so much work"), and (c) the issue is added to a subsequent sprint, so
that it can be addressed later.
## Completed Issues/User Stories
Here are links to the issues that we completed in this sprint:
* [Create VM for Database in Terraform](https://github.com/Inventor4life/Beef/issues/6)
* [Set up MongoDB in the Database VM](https://github.com/Inventor4life/Beef/issues/7)
* [Set Database to use Added Disk](https://github.com/Inventor4life/Beef/issues/12)
* [Configure MongoDB to Start at Boot](https://github.com/Inventor4life/Beef/issues/13)
* [Make Sure Terraform Doesn't Resize System Disks](https://github.com/Inventor4life/Beef/issues/14)
* [Plan Out Minimum Viable Product](https://github.com/Inventor4life/Beef/issues/15)
* [Transfer User Stories Google Doc to GitHub](https://github.com/Inventor4life/Beef/issues/18)
* [Create Production VM](https://github.com/Inventor4life/Beef/issues/20)
* [Create First Service](https://github.com/Inventor4life/Beef/issues/23)
* [Bug: Users Cannot Perform git pull in Production VM](https://github.com/Inventor4life/Beef/issues/24)
* [Set up DHCP in OpnSense](https://github.com/Inventor4life/Beef/issues/25)
* [Bug: First Service Process Name Override (in src/main.ts) is Broken](https://github.com/Inventor4life/Beef/issues/29)
* [Add Required Dependencies for First Service](https://github.com/Inventor4life/Beef/issues/30)
* [Add Middleware to main.ts](https://github.com/Inventor4life/Beef/issues/32)
* [Implement Google Auth Verification](https://github.com/Inventor4life/Beef/issues/33)
* [Implement JWT Verification Middleware](https://github.com/Inventor4life/Beef/issues/34)
* [Make HTTPS Certs for Production and Development](https://github.com/Inventor4life/Beef/issues/35)
* [Write Production Auth Section](https://github.com/Inventor4life/Beef/issues/36)
* [Configure First Service to use HTTPS Rather Than HTTP](https://github.com/Inventor4life/Beef/issues/37)
* [Write Production Messages Section](https://github.com/Inventor4life/Beef/issues/38)
* [Update Our Project README](https://github.com/Inventor4life/Beef/issues/40)
* [Create Production Build Docs](https://github.com/Inventor4life/Beef/issues/41)
* [Bug: Update Auth Redirects to Reflect APP_ENV](https://github.com/Inventor4life/Beef/issues/48)

## Incomplete Issues/User Stories
Here are links to issues we worked on but did not complete in this sprint:
* Migrate Database VM to Dedicated Node - This was more of an "upgrade" than an issue. The database works fine as-is,
 but we do have a node available with 1TB of storage and 16GB of RAM, as opposed to the 16GB of storage and 2GB of RAM
 the database currently has. The upgrade is not immediately required so was pushed to a future sprint.
* Implement Access Control in MongoDB - Similar to above, the database works fine as is. Given that we only have a
 single instance of a single service to access the db and the db is not publically accessible, this feature was
 found to be irrelevant for the MVP.
* Incorporate `opti1` into Proxmox Cluster - This is the infrastructure counterpart of the Migrate Database issue.
 `Opti1` is the node that will eventually hold our database.
* Create Development VMs - This was cut from sprint 1 due to time constraints. Given that we do not have a consistently
 running service, we were able to pull the development branches onto the production server for testing.
* Configure Cloudflare WARP Server/Clients to Allow VPN Access from WSU NAT - The VPN is set up, but we haven't got it
 working reliably on all machines. Since we had a backup VPN set up already, we use that for the duration of this sprint
* Configure First Service to start at boot. Research some way to automate it for other services/production machines? 
 ideally this would be part of our minimum viable product. However we haven't had to restart the production VM at all, 
 and starting the production service is as simple as running `./server-start.sh`.
* Update Production HTTPS Certificate Permissions to Only be Accessible by the Deploy User - We found that this issue
 was out of scope for our minimum viable product. This commit would be good to improve the security of our service, but
 our service is not accessible from WAN and thus the added security is not needed.
* Rewrite DB Bindings to be Modular and Ignorable - This is one of our top issues for the next sprint. Currently we
 have a `connectToDB()` function that connects to the database and selects the `messages` collection, but prevents
 the server from starting until it has successfully done so. Since we only need the `messages` collection for this
 MVP, we are moving this to the next sprint.
## Code Files for Review
Please review the following code files, which were actively developed during this
sprint, for quality:
* [main.ts](https://github.com/Inventor4life/Beef/blob/main/services/first-service/src/main.ts)
* [middleware.ts](https://github.com/Inventor4life/Beef/blob/main/services/first-service/src/middleware.ts)
* [messages.ts](https://github.com/Inventor4life/Beef/blob/main/services/first-service/src/messages.ts)
* [db.ts](https://github.com/Inventor4life/Beef/blob/main/services/first-service/src/db.ts)
* [index.html](https://github.com/Inventor4life/Beef/blob/main/services/first-service/data/index.html)
## Retrospective Summary
Here's what went well:
* Item 1
* Item 2
* Item x
Here's what we'd like to improve:
* Item 1
* Item 2
* Item x
Here are changes we plan to implement in the next sprint:
* Item 1
* Item 2
* Item x
