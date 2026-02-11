# Beef
## Introduction
Beef is a discord clone created for WSU's Cpts 322 (Software Engineering I) course. It is designed to give our devs
 experience in microservice architectures and MERN web development while also working as a functional text and voice chat platform.
 
## The Name
There are a handful of reasons why "Beef" was chosen as our project name. The first and foremost being that this is a student project and is not meant to compete with real products.
 As such, we decided that an unappealing parody name would be appropriate. Second, having a parody name such as "Beef" allows us to give cow-related themes to our features: Th


## Directory Structure
`infra/` contains information and configurations related to our infrastructure; committing this to public source control carries significant security risks, and our reasons for doing so are discussed in the [Infrastructure](#infrastructure) section.

`experiments/` contains some of the experiments that were run during the development process. Each experiment gets its own subdirectory and should be accompanied by a README explaining the purpose of the experiment (and findings, if any).

`services/` contains code for all services that we may deploy. Each service gets its own subdirectory, README, and docs.

`tools/` contains developer tools such as local build/deployment scripts and whatever else we need later.

`docs/` contains information that doesn't fit into the above categories. This may include the public API, request lifecycle, etc.

## Infrastructure
Despite the security risk involved in publically committing this information, we are doing so for the following reasons:

1. The primary purpose of this app is to gain development experience and to demonstrate to employers that we have done so.
 Disclosing our infrastructure allows public review (and feedback) of our design decisions while also providing proof-of-progress during infrastructure related projects.

2. We do not (yet) have the knowledge to competently claim that our infrastructure is secure, though amateur attempts to secure it will be made and documented.

3. No sensitive information should be stored here. It will be disclosed to users that they are using student-developed software and that their messages are public, auditable, and insecure.
 Login services are outsourced, and all OIDC subject IDs are converted to internal userIDs to reduce their attack surface. 

4. Our service runs self-hosted on dedicated machines that are separated from other networks. Complete host compromise should (in theory) have no consequence except for free compute for an attacker until the attack is noticed (and the servers unplugged).

5. All API keys are for free services only, time limited, and scoped to only the necessary permissions for our service to function.

6. All passwords used in the infrastructure are randomly generated, and no passwords are reused (even within the infrastructure).
