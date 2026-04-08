# Sprint 3 - Due April 25th, 2026
## Introduction
This document details the changes that should be completed over sprint 3. It may change over time as development continues and new information is encountered.
## User stories
 - I can scroll up to view historical messages in a channel
 - I can create a guild
 - I can invite others to my guild with a link
 - I can join a guild with a link
 - I can receive messages in a channel in real time
 - I can join a voice channel and hear other users in the channel

As a guild owner:
 - I can create text and voice channels in a server

## General Changes
 - Add favicon.ico
 - Remove the GET/POST `/messages` endpoint
 - Remove the GET `/test-auth` endpoint
 - Add WebSocket support: used in voice, live messages, and name changes.
 - Implement general limits (such as message sizes, max # of channels per guild, max # of guilds a user can be in)
 - Update our auth middleware to let us specify scope
 - Implement endpoint access permissions using the above middleware (e.g. regular users cannot access POST `/users`)
 - Implement data access controls (e.g. a user cannot see what channels are available in the guild unless they are a member of the guild)
 - Add voice channels to guilds
 - Add invite link creation to guilds
 - Use `/` as our index page URL, instead of `/auth`
 - Redirect the user to #/success on successful login, rather than #/chat
 - Allow users to scroll up to view historical messages.

## Basic Recommended limits (to be discussed):
Messages:
 - 500 characters long

Guilds:
 - Up to 16 messaging channels
 - Up to 2 voice channels
 - Up to 1 invite link
 - Max name of 32 displayable ascii characters [a-z][A-Z][0-9]...
 - Name cannot start with whitespace

Channels:
 - Max name of 32 displayable characters
 - Name cannot start with whitespace

Users:
 - Up to 16 guilds they can be members in (including guilds they own).
 - Max name of 32 displayable ascii characters [a-z][A-Z][0-9]...
 - Name cannot start with whitespace
 - Name will _not_ be set automatically from Google OAuth token. Randomly generate?

## Discussion:
 > Q: Why only one invite link per server?

 A: Having multiple invites would require a UI so that the user could select which invite they wish to use to invite other users. We would also need to implement dynamic invite creation/deletion. Currently, we will create an invite link when the guild is created. Invites are set up so that we can add creation/deletion/statistics later without invalidating current invites.

 > Q: Why not set the name from Google's OAuth token?

 A: Two reasons: First, Google's token is not guaranteed to have a `name` field present. In order to avoid a bunch of users with names that default to "Anonymous", we need to add default name generation anyway.

 Second, we would need to verify that the user's google name follows the user naming rules above and assign a default name if not. Having generated names assigned by default and letting users change them later is easier.

## Data structures

 - Update `Guilds` to the following:
 ```
 {
    "_id": String, # Same as above, uses Guild snowflake as primary key.

    "friendlyName": String, # The Guild's display name

    "owner": String, # Snowflake ID of the guild's owner
    
    "members": String[], # A list of snowflakeIDs of guild members
    
    "channels": [
      {
        "_id": String, # The Channel's SnowflakeID
        "friendlyName": String, # The Channel's display name
        "type": String # Currently either "Voice" or "Text"
      }
    ],

    "invites": String[], # A list of invite snowflakes (will only contain one invite in this version)
 }
 ```

 - Create the `Invites` collection with the following:
 ```
 {
    "_id": String, # The invite's snowflake
    "guildID": String # The snowflake of the guild the invite leads to.
 }
 ```

 - Update our Beef JWTs to have the following structure:
 ```
 {
    "aud": String, # Will always be "Beef" for our Beef tokens
    "sub": String, # The user's Beef ID. Will be empty for service tokens
    "scope": String, # Space-delimited permissions
    "iat": Number, # When the token was issued
    "exp": Number, # When the token expires
    "iss": String, # Whoever signed the token. Will be "Auth" for the near future.
 }
```

## Auth Middleware
In preparation for our live demo, we need to update our auth middleware to not only validate the JWTs, but also to check the `scope` field for the correct permissions.
In this version, we only have two permissions we need to worry about: `service` and `user`. We need to return status `401` if the token is invalid, or status `403` if the token is valid but lacks the necessary permissions. The Auth middleware needs to be modified to have our current `requireAuth` that checks for a valid token, as well as a `requireAuthScope("scope-name")` middleware factory that checks for the appropriate scope. In the future, this might be best managed through combinators like `requireAuth.any(requireAuth.hasScope("user"), requireAuth.hasScope("admin"))`.
Scopes are represented by a space-delimited string, such as `user`, `admin`, `service admin`, `user guilds:create`, or `service voice:join channel:create message:send`.

### Current Scopes:
| scope   | description |
|---------|---------------------|
|`user`   | standard user token |
|`service`| service token, can access business-logic-related endpoints |

## API
## Auth
> POST `/auth`

Accepts a JWT signed by google in the header, sets a Beef JWT header cookie for the relevant user, under the `user_token` name. This endpoint is currently only queried by the Google Identity Services library and requires no front-end configuration. Redirects the user to `#/success` when finished. 

### Preconditions:
 - User must have logged in via Google.

### Status codes:
| Code | Cause                      |
|------|----------------------------|
|`200` | Success                    |
|`401` | Invalid Token              |
|`500` | Other error                |
|`503` | Cannot connect to database |

### Changes from last version:
Auth now redirects to `#/success` rather than `#/chat`. Auth also adds the `user` scope to user tokens.

---
---
## Users
> POST `/users/{userID}/guildMemberships`

Adds the guild specified in the request body to the specified user. Does not check that the guild exists. Does not add the user to the specified guild's `members` list.

### Required scope: `service`

### Request Body:
```
{
  guildID: String # The desired guild to add to the user's membership list
}
```

### Response Body: None (unless error)

### Parameters:
| Parameter | Description                                       |
|-----------|---------------------------------------------------|
| `userID`  | The snowflakeID (as a string) of the desired user |

### Status codes:
| Code | Cause                      |
|------|----------------------------|
|`201` | Successfully added guild   |
|`401` | Invalid Token              |
|`403` | Permission denied          |
|`404` | User not found             |
|`409` | User guild limit exceeded  |
|`500` | Other error                |
|`503` | Cannot connect to database |

---
---
> POST `/users`

Creates the user specified in the request body. Returns the created `User` structure. The friendlyName field will be auto-generated if omitted.

### Request Body:
```
{
    "oidcSub": String, # The ID given by the OIDC provider
    "friendlyName"?: String, # The User's display name (optional)
}
```

### Response Body:
A `User` data structure with the request information, as well as a unique `_id` and the user's list of guild memberships.

### Required Scope: `service`

### Precondition
 - The service making the request must present a valid Beef token

### Status codes:
| Code | Cause                            |
|------|----------------------------------|
|`201` | Resource Created                 |
|`400` | Invalid request (missing or malformed fields) |
|`401` | Missing Auth token               |
|`403` | Permission Denied                |
|`500` | Other error                      |
|`503` | Cannot connect to database       |

### Changes from last version:
The `friendlyName` parameter is now optional. If not included, the service will generate one for you. Using this endpoint now requires the `service` scope.

---
---
> GET `/users/me`

Returns the `User` structure for the currently logged-in user.

### Required Scope: `user`

### Preconditions:
 - User must be signed in.

### Status codes:
| Code | Cause                             |
|------|-----------------------------------|
|`200` | Success                           |
|`400` | Malformed user token              |
|`401` | Invalid token (user not signed in)|
|`403` | Permission Denied                 |
|`404` | User not found                    |
|`500` | Other error                       |
|`503` | Cannot connect to database        |

### Changes from last version:
This endpoint now requires the `user` scope. Will return status `403` if required scope is missing.

---
---

> GET `/users/{userID}`

Returns the `User` structure that matches the requested ID. This method should only be used by the back end.

### Required Scope: `service`

### Parameters:
| Parameter | Description                                       |
|-----------|---------------------------------------------------|
| `userID`  | The snowflakeID (as a string) of the desired user |

### Preconditions:
 - User must be signed in.

### Status codes:
| Code | Cause                      |
|------|----------------------------|
|`200` | Success                    |
|`401` | Missing Auth token         |
|`403` | Permission Denied          |
|`404` | User not found             |
|`500` | Other error                |
|`503` | Cannot connect to database |

### Changes from last version:
This endpoint now requires the `service` scope

---
---

> GET `/users?oidcSub={oidcSubID}`

Returns the `User` structure that matches the requested sub ID. This method should only be used by the backend to query for existing users during sign-in.

### Required scope: `service`

### Response body:
The `User` structure that matches the requested sub ID.

### Parameters:
| Parameter  | Description                                       |
|------------|---------------------------------------------------|
| `?oidcSub` | The OIDC subject ID of the desired user           |

### Preconditions:
 - The service making the request must present a valid Beef token.

### Status codes:
| Code | Cause                          |
|------|--------------------------------|
|`200` | Success                        |
|`400` | Invalid (or missing) `oidcSub` |
|`401` | Missing Auth token             |
|`403` | Permission Denied              |
|`404` | User not found                 |
|`500` | Other error                    |
|`503` | Cannot connect to database     |

### Changes from last version:
This endpoint now requires the `service` scope

---
---

## Guilds
> POST `/guilds`

Creates the specified guild and assigns the current user as the owner. Calls the invite generator API and returns the newly created guild.

### Preconditions:
 - User must be signed in

### Required scope: `user`

### Request Body:
```
{
  "friendlyName": String # The friendly name of the guild to be created.
}
```

### Response Body:
Returns the newly created `Guild` structure. Including the generated `_id` field. Contains no channels.

### Status codes:
| Code | Cause                          |
|------|--------------------------------|
|`201` | Success                        |
|`400` | Malformed input (friendlyName) |
|`401` | Missing Auth token             |
|`403` | Permission Denied              |
|`409` | User guild limit exceeded      |
|`500` | Other error                    |
|`503` | Cannot connect to database     |

---
---

> POST `/guilds/{guildID}/channels`

Creates a channel within the specified guild. Returns the newly created channel information (friendlyName, type, and _id)

### Preconditions:
 - User must be signed in

### Required scope: `user`

### Parameters:
| Parameter  | Description                  |
|------------|------------------------------|
| `{guildID}`| The ID of the targeted guild |

### Request Body:
```
{
  "friendlyName": String, # The friendly name of the guild to be created.
  "type": String # The type of channel to be created: Currently either "Voice" or "Text"
}
```

### Response Body:
Returns the newly created `Channel` information (friendlyName, type, and _id).

### Status codes:
| Code | Cause                          |
|------|--------------------------------|
|`201` | Success                        |
|`400` | Malformed input                |
|`401` | Missing Auth token             |
|`403` | Permission Denied              |
|`404` | Guild not found                |
|`409` | Guild channel limit exceeded   |
|`500` | Other error                    |
|`503` | Cannot connect to database     |

### Note:
The status `403` can be triggered if the requesting user is not the guild owner, not just if a token missing the `user` scope is used.

---
---
> POST `/guilds/{guildID}/members`

Adds a user to a guild. Calls the `/users/.../memberships` API internally to maintain user<->guild linking.

### Required scope: `service`

### Parameters:
| Parameter  | Description                  |
|------------|------------------------------|
| `{guildID}`| The ID of the targeted guild |

### Request Body: 
```
{
  "userID": String # The ID of the user to add to the guild
}
```

### Response Body: None (except error)

### Status codes:
| Code | Cause                          |
|------|--------------------------------|
|`201` | Success                        |
|`401` | Missing Auth token             |
|`403` | Permission Denied              |
|`404` | Guild or user not found        |
|`409` | User guild limit exceeded      |
|`500` | Other error                    |
|`503` | Cannot connect to database     |

---
---

> GET `/guilds/{guildID}`

Returns the `Guild` structure that matches the requested `guildID`.

### Parameters:
| Parameter | Description                                        |
|-----------|----------------------------------------------------|
| `guildID` | The snowflakeID (as a string) of the desired guild |

### Preconditions:
 - User must be signed in.

### Status codes:
| Code | Cause                      |
|------|----------------------------|
|`200` | Success                    |
|`401` | User is not signed in      |
|`403` | Permission Denied          |
|`404` | Guild not found            |
|`500` | Other error                |
|`503` | Cannot connect to database |

### Changes since last version:
This endpoint will now return status `403` if the requesting user is not a member of the guild. Alternatively, the request is allowed if a token containing the `service` scope is used.

---
---

> GET `/guilds/{guildID}/short`

Returns the `friendlyName` and `_id` fields of the requested guild.

### Parameters:
| Parameter | Description                                        |
|-----------|----------------------------------------------------|
| `guildID` | The snowflakeID (as a string) of the desired guild |

### Preconditions:
 - None: No sign-in necessary

### Response Body:
```
{
  "_id": String, # The snowflakeID of the requested guild
  "friendlyName", # The friendlyName of the requested guild
}
```

### Status codes:
| Code | Cause                      |
|------|----------------------------|
|`200` | Success                    |
|`404` | Guild not found            |
|`500` | Other error                |
|`503` | Cannot connect to database |

---
---

## Invites:
> POST `/invites`

Creates an invite for the requested server. Returns an invite code. Does not validate that the guildID exists.

### Required scope: `service`

### Request Body:
```
{
  "guildID": String # The snowflake of the guild we wish to create an invite for.
}
```

### Response Body:
```
{
  "inviteCode": String, # The code used to identify the invite.
  "guildID": String # The ID of the guild that the invite links to.
}
```

### Status codes:
| Code | Cause                          |
|------|--------------------------------|
|`201` | Success                        |
|`401` | Missing Auth token             |
|`403` | Permission Denied              |
|`500` | Other error                    |
|`503` | Cannot connect to database     |

---
---

> GET `/invites/{inviteCode}`

Get the guild associated with a particular invite.

### Parameters:
| Parameter    | Description                                        |
|--------------|----------------------------------------------------|
| `inviteCode` | The code of the desired invite to get              |

### Preconditions:
 - None: No sign-in necessary

### Response Body:
```
{
  "inviteCode": String, # The code used to identify the invite.
  "guildID": String # The ID of the guild that the invite links to.
}
```

### Status codes:
| Code | Cause                          |
|------|--------------------------------|
|`200` | Success                        |
|`404` | Invite not found               |
|`500` | Other error                    |
|`503` | Cannot connect to database     |

---
---

> POST `/invites/{inviteCode}`

Accept an invite, joining the guild.

### Parameters:
| Parameter    | Description                                        |
|--------------|----------------------------------------------------|
| `inviteCode` | The code of the desired invite to use.             |

### Preconditions:
 - User must be signed in

### Required scope: `user`

### Request Body: None

### Response Body: None (except error)

### Status codes:
| Code | Cause                          |
|------|--------------------------------|
|`201` | Success                        |
|`401` | Invalid token                  |
|`403` | Permission denied              |
|`404` | Invite or guild not found      |
|`500` | Other error                    |
|`503` | Cannot connect to database     |

---
---

# Voice
### Note:
The voice endpoint uses websockets rather than HTTP methods. The documentation is a little less structured here, as the data has a two-way flow.

## Data structures:
### `Offer`
```
{
  "type": "Offer",
  "sdp": ... # WebRTC Offer data
}
```

### `Answer`
```
{
  "type": "Answer",
  "sdp": ... # WebRTC Answer data
}
```

### `IceCandidate`
{
  ""
}

## Flow:
This structure can be sent by either the client or the server and contains a WebRTC offer. When received by the client, the client should process the offer and respond with an `Answer` structure. When an `Offer` is sent by the client, the server will respond with



## Business Logic
