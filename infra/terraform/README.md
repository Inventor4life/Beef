# Terraform
## Status
This is a work-in-progress file that will change often as our infrastructure matures. At some point I would like to use
 terraform to manage all infrastructure; inital tests show that it is very useful and convenient.
## TODO
 - Restructure the existing terraform files to not be a single jumbled mess
 - Find a way to test terraform deployments.
 - Find a way to manage passwords/ssh keys/secrets for the managed machines. Ideally most of these machines won't need
  developer access at all, but I do want to keep backups of all secrets.
