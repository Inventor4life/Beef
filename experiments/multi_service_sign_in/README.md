# Multiservice Sign In With Google
by Ethan Goode

## Description
This experiment involved setting up the same sign-in-with-google button as sign-in-with-google experiment, except it
 used multiple services:

 - The `Gateway` service (using Node and Express) worked as an endpoint for incoming HTTPS traffic. It receives the
  traffic, reads the destination URL, and then proxies it to the appropriate internal service. All traffic (internal
  and external) is secured using HTTPS.
  
 - The `Presenter` service (Again, Node and Express) receives traffic routed to the `/index` endpoint and checks if
  the client has been issued an internal Beef JWT signed by the `Auth` service and validates the token if so. If the
  client has not, they are presented with a login page. If they have already logged in, they are instead presented
  with a welcome page built from a template. The template currently displays a welcome message and the client name;
  the client name that was retrieved from the internal JWT.
  
 - The `Auth` service receives traffic routed to the `/Auth` endpoint and checks if it contains a valid JWT signed by
  Google. If so, the `Auth` service converts the `sub` field provided by Google into an internal `sub` value (in this
  case it is the same `sub` value, but prepended with `beefid:`. The `Auth` service then fills in some other values
  (`iss`, `aud`, etc) and then signs the JWT using a secret shared with `Presenter`. Regardless of whether Google's
  token was valid, invalid, missing, or if some other error occured when creating the internal token, the user is
  finally redirected back to the `/index` endpoint.
  
## Notes

 - Although the experiment only functions for people with designated tester accounts, you can start the services yourself
  using the provided `start.bat` script in the experiment root. For people that are using other operating systems, the
  script is not terribly complex and may even function as-is (ignoring the extension).

 - The HTTPS Agents set up in `gateway.ts` may be required for now. Attempting to connect via https without allowing
  the self-signed certificate with the agent results in errors.
  
 - When self-signing certificates for development, make sure to include the domain the certificate is for. I may have
  done this last time but neglected to write it down. `localhost` was used as the FQDN for this experiment.
  
 - The control paths for a failed Google token authentication have not been tested.
 
 - I'm excited to start working on the project. The multi-service test went surprisingy well, to the point that I think
  that the main project will be just as easy (famous last words). We are missing a lot (all) of the testing aspect (I'm
  not quite sure how javascript tests would work here. Maybe set up a simulated client and send in different kinds of
  traffic?).
  
 - I'm concerned about routing between services in production. Right now each service was listening on `localhost` on
  ports `3000`, `3001`, `3002` with the Gateway proxying traffic to the other ports. If a multi-container or multi-host
  environment, we need some way to route traffic to the services. We could use dedicated IPs for service instances to
  start, but we'll eventually need to set up some kind of SPIRE / kubernetes DNS system.
  
 - Not sure if using JWTs to authZ and authN users is correct for this kind of setup. The Gateway is exposed to (nearly)
  all inbound traffic, and all internal tokens go through the gateway. If the gateway were to be compromised, an attacker
  could impersonate any currently logged in user. I feel like our design is incorrect because of that.
  
 - Currently scheduling a meeting with our cybersecurity mentor to get his opinion. One alternative I'm currently
  researching is to use DNS CNAME records so that the gateway (which will likely be Envoy in prod) can route via SNI
  without decrypting traffic or intercepting tokens. Will bring this up during the meeting to get feedback, but my gut
  reaction is that having a bunch of CNAME records for each user-facing service is ...untidy? Even if this is the route
  we go, I'm unsure how we would inject fake DNS records into the cache for testing outside of prod, though it's probably
  very easy.
