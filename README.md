# Beef

## Project Summary

### One-sentence description of the project

Beef is a Discord clone built with a microservice architecture using the MERN stack, developed as a student project for WSU's Cpts 322 (Software Engineering I) course.

### Additional information about the project

Beef is a text and voice chat platform that mirrors core Discord functionality — guilds, channels, real-time messaging, and Google-based authentication. The project is intentionally given a parody name to reflect its student-project nature, with cow-themed touches like "Rare" and "Well Done" light/dark mode themes. The codebase is organized around independent, deployable services that communicate over a self-hosted network infrastructure managed with Terraform and OPNsense.

### Note About Infrastructure
Despite the security risk involved in publically committing this information, we are doing so for the following reasons:

1. The primary purpose of this app is to gain development experience and to demonstrate to employers that we have done so.
 Disclosing our infrastructure allows public review (and feedback) of our design decisions while also providing proof-of-progress during infrastructure related projects.

2. We do not (yet) have the knowledge to competently claim that our infrastructure is secure, though amateur attempts to secure it will be made and documented.

3. No sensitive information should be stored here. It will be disclosed to users that they are using student-developed software and that their messages are public, auditable, and insecure.
 Login services are outsourced, and all OIDC subject IDs are converted to internal userIDs to reduce their attack surface. 

4. Our service runs self-hosted on dedicated machines that are separated from other networks. Complete host compromise should (in theory) have no consequence except for free compute for an attacker until the attack is noticed (and the servers unplugged).

5. All API keys are for free services only, time limited, and scoped to only the necessary permissions for our service to function.

6. All passwords used in the infrastructure are randomly generated, and no passwords are reused (even within the infrastructure).

## Installation

### Prerequisites

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) (with `npm`)
- [TypeScript](https://www.typescriptlang.org/) (`npm install -g typescript`)
- [MongoDB](https://www.mongodb.com/) (accessible instance — see `.env.example` for connection URI)
- A Google OAuth 2.0 Client ID (for authentication)
- OpenSSL or equivalent for generating TLS certificates (dev certs are provided in `tools/dev-certs/`)

### Add-ons

| Package | Purpose |
|---------|---------|
| [Express](https://expressjs.com/) (v5) | Web framework and routing |
| [MongoDB Driver](https://www.npmjs.com/package/mongodb) | Database client for storing messages and user data |
| [jsonwebtoken](https://www.npmjs.com/package/jsonwebtoken) | Signing and verifying internal JWTs for session management |
| [google-auth-library](https://www.npmjs.com/package/google-auth-library) | Verifying Google OAuth tokens during sign-in |
| [cookie-parser](https://www.npmjs.com/package/cookie-parser) | Parsing cookies (used to read auth JWTs from requests) |
| [dotenv](https://www.npmjs.com/package/dotenv) | Loading environment variables from `.env` files |
| [TypeScript](https://www.typescriptlang.org/) | Static type checking and compilation |

### Installation Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/Inventor4life/Beef.git
   cd Beef
   ```

2. Navigate to the service directory:
   ```bash
   cd services/first-service
   ```

3. Install dependencies:
   ```bash
   npm ci
   ```

4. Create your environment file by copying the example:
   ```bash
   cp .env.example .env
   ```

5. Edit `.env` and fill in the required values:
   - `GOOGLE_CLIENT_ID` — your Google OAuth 2.0 client ID
   - `LOGIN_URI` — set to `https://localhost:3000/auth` for local development
   - `JWT_SECRET` — a secret key used to sign internal JWTs
   - `JWT_EXPIRY` — token lifetime in seconds (default `900` = 15 minutes)
   - `MONGO_URI` — your MongoDB connection string (e.g., `mongodb://localhost:27017`)

6. Compile TypeScript:
   ```bash
   tsc
   ```

7. Start the service:
   ```bash
   # Using the provided script (from the repo root):
   ./services/first-service/server-start.sh dev

   # Or manually:
   export APP_ENV="DEVELOPMENT"
   node build/main.js
   ```

   The server will start at `https://127.0.0.1:3000/` in development mode.

## Functionality

1. **Navigate to the root URL** (`/`) — you will see a landing page.
2. **Log in** — visit `/auth` to sign in with Google. After successful authentication, you receive a JWT stored as an HTTP-only cookie.
3. **Send messages** — `POST /guilds/channels/messages` with a JSON body containing `{ "content": "your message" }` sent to the specific channels endpoint. Requires authentication.
4. **View messages** — `GET /guilds/channels/messages` returns all messages in the channel. Requires authentication.
5. **Test authentication** — `GET /test-auth` returns the decoded JWT payload for the current user.
6. **Guilds** — `Get /guilds` returns the specific guild that the user is a member of. Requires authentication.
7. **Users** — `Get /users` returns the user information, used to determine what Guilds to get when loading Guilds. Requires authentication.
8. **Channels** — `Get /guilds/channels` channels are arrays that each guild object contains. The frontend uses the channel array directly. Requires authentication. 

Messages have the following structure:
```json
{
  "id": 1,
  "author": "Display Name",
  "content": "Hello, world!"
}
```

## Known Problems

- The process title for the service is hardcoded in `main.ts` rather than being set by the startup script (noted in source comments).
- No automated tests exist (`npm test` currently exits with an error stub).
- No historical messaging.
- We are bypassing the security provided by certificates for our endpoint to endpoint api calls.

## Contributing

1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request :D

**Note:** No commits can be made directly to `main`. All changes must go through a pull request and be reviewed by another developer.

## Additional Documentation

- [User Stories](docs/UserStories.md)
- [Minimum Viable Product Spec](docs/MinimumViable.md)
- [Building in Production](docs/BuildingInProd.md)
- [Network Topology](infra/network-topology.md)

## License

This project currently has no License — see the [LICENSE.txt](LICENSE.txt) file for details.
