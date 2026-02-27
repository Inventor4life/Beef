# First service
## Description
This service will be used as a baseline for our project. While we are using a monolithic
 service structure, this will likely be the service we are building upon.

## Configuration
This service checks if the `PRODUCTION` environment variable is set to determine appropriate bindings (below)

## Bindings
If `PRODUCTION` is set:
 - `http://10.0.0.6:3000`
Otherwise:
 - `http://localhost:3000`
