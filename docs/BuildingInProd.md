# Building in Production
Our current tech stack (with typescript) requires some setup before services can be updated. Eventually there will be
 some setup involved before services can be added (so that they start on boot), in which case this document will need
 to be updated.
 
## Updating a service
1. Navigate to the service directory. For this example, we will be using `services/first-service`.
2. Pull the update from the git repo: `sudo -u deploy git pull`. `deploy` is a dedicated user with access to the
 git deploy key. Password login has been disabled for deploy, so only sudo users can update the repo.
3. Run `npm ci` to clean install all packages (we haven't yet found a command to only install new packages/uninstall unneeded packages)
4. Run `tsc` to compile all typescript into javascript files to be run.
5. Add/remove/update any untracked files that are neccessary for the service to run (such as private keys, access codes, etc).
6. Done!
