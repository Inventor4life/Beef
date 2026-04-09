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

Voice Channels:
 - Max name of 32 displayable characters
 - Name cannot start with whitespace
 - Up to 16 users in a channel at any time.

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

 - Update our `Beef JWT`s to have the following structure:
 ```
 {
    "aud": String, # Will always be "Beef" for our Beef tokens
    "sub": String, # The user's Beef ID. Will be empty for service tokens
    "scope": String, # Space-delimited permissions
    "iat": NumericDate, # When the token was issued
    "exp": NumericDate, # When the token expires
    "iss": String, # Whoever signed the token. Will be "Auth" for the near future.
 }
```

 - Create `Channel tokens` to have the following structure: (note that this is not a DB collection)
```
 {
    "aud": String, # Will be "Beef-live"
    "sub": String, # The user's Beef ID.
    "guild": String, # The guildID of the requested channel
    "channel": String, # The ID of the channel we wish to get updates from.
    "iat": NumericDate, # When the token was issued
    "exp": NumericDate, # When the token expires
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

# API
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

> POST `/users/me/friendlyName`

Changes the current user's friendly name.

### Precondition
 - The user must be logged in

### Required Scope: `user`

### Request Body:
```
{
  "friendlyName": String # The User's new display name
}
```

### Response Body:
The `User` data structure for the current user, with the updated friendly name.

### Status codes:
| Code | Cause                            |
|------|----------------------------------|
|`201` | Resource Created                 |
|`400` | Invalid request (missing or malformed fields) |
|`401` | Missing Auth token               |
|`403` | Permission Denied                |
|`500` | Other error                      |
|`503` | Cannot connect to database       |

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
|`200` | User already in guild          |
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

### Required Scope: either `user` or `service`

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

> GET `/guilds/{guildID}/channels/{channelID}/messages?beforeID={oldest}`

Returns an array of up to 50 `Message`s in the channel. Will return the most recent 50 if `beforeID` is not specified, or the 50 messages leading up to `beforeID` if it is.

### Parameters
| Parameter   | Description                                           |
|-------------|-------------------------------------------------------|
| `guildID`   | The snowflakeID (as a string) of the relevant guild   |
| `channelID` | The snowflakeID (as a string) of the relevant channel |
| `?beforeID` | (Optional) The desired message to get other messages prior to. Used for getting historical messages |

### Preconditions:
 - User must be signed in.

### Required Scope: `user`

### Error codes:
| Code | Cause                      |
|------|----------------------------|
|`200` | Success                    |
|`401` | User is not signed in      |
|`403` | Permission Denied          |
|`404` | Guild or channel not found |
|`500` | Other error                |
|`503` | Cannot connect to database |

### Notes:
Status `403` is sent when the requesting user is not a member of the guild

### Changes since last version
Status `403` is returned when the requesting user is not a member of the guild. This endpoint now requires the scope `user`.

---
---

> POST `/guilds/{guildID}/channels/{channelID}/messages`

Creates a message in the desired channel. Returns the `Message` structure created.

### Preconditions:
 - User must be signed in.

### Required Scope: `user`

### Parameters:
| Parameter   | Description                                           |
|-------------|-------------------------------------------------------|
| `guildID`   | The snowflakeID (as a string) of the relevant guild   |
| `channelID` | The snowflakeID (as a string) of the relevant channel |

### Request Body:
```
{
    "content": String # the content of the message to be created.
}
```

### Response Body:
The created `Message` structure, including the generated `_id`

### Error codes:
| Code | Cause                      |
|------|----------------------------|
|`201` | Resource Created           |
|`400` | Malformed input            |
|`401` | User is not signed in      |
|`403` | Permission Denied          |
|`404` | Guild or channel not found |
|`500` | Other error                |
|`503` | Cannot connect to database |

### Changes since last version:
Status `403` is now returned if the user is not in the guild. Status `400` is returned if the message is empty or too long. The scope `user` is now required to use the endpoint.

### Notes:
Status `403` should be returned if the current user is not a member of the requested guild.

---
---

> POST `/guilds/{guildID}/channels/{channelID}/token`

Issues a `Channel token` that will allow the user to access the channel's WebSocket interface.

### Preconditions:
 - User must be signed in.

### Required Scope: `user`

### Parameters:
| Parameter   | Description                                           |
|-------------|-------------------------------------------------------|
| `guildID`   | The snowflakeID (as a string) of the relevant guild   |
| `channelID` | The snowflakeID (as a string) of the relevant channel |

### Request Body: None


### Response Body:
```
{
  "token": String # The channel's access token
}
```

### Error codes:
| Code | Cause                      |
|------|----------------------------|
|`201` | Resource Created           |
|`401` | User is not signed in      |
|`403` | Permission Denied          |
|`404` | Guild or channel not found |
|`500` | Other error                |
|`503` | Cannot connect to database |

### Notes:
Status `403` should be returned if the current user is not a member of the requested guild, or if the `user` scope is not present.

These tokens are used to access the websocket interface of the channel.

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
|`200` | User already in guild          |
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

## Live:

> POST `/live/messages`

Route a message to users connected via WebSocket. Does not verify the content within the message.

### Required scope: `service`

### Request Body:
The `Message` structure to be sent.

### Response Body: None (except error)

### Status codes:
| Code | Cause                          |
|------|--------------------------------|
|`201` | Success                        |
|`400` | Malformed input                |
|`401` | Invalid token                  |
|`403` | Permission denied              |
|`500` | Other error                    |
|`503` | Cannot connect to database     |

---
---

> POST `/live/name-change`

Route a nameChange update to users connected via WebSocket.

### Required scope: `service`

### Request Body:
The short `User` structure to be sent (_id and friendlyName)

### Response Body: None (except error)

### Status codes:
| Code | Cause                          |
|------|--------------------------------|
|`201` | Success                        |
|`400` | Malformed input                |
|`401` | Invalid token                  |
|`403` | Permission denied              |
|`500` | Other error                    |
|`503` | Cannot connect to database     |

---
---

# Voice: `/voice`
### Note:
The voice endpoint uses websockets rather than HTTP methods. The documentation is a little less structured here, as the data has a two-way flow.

## Data structures:
### `Offer`
A WebRTC offer
```
{
  "type": "Offer",
  "sdp": ... # WebRTC Offer data
}
```

### `Answer`
A WebRTC Answer
```
{
  "type": "Answer",
  "sdp": ... # WebRTC Answer data
}
```

### `IceCandidate`
A WebRTC Ice Candidate
```
{
  "type": "IceCandidate",
  "candidate": ... # WebRTC Candidate data
}
```

### `Join`
Used to join a voice channel given a channel token.
```
{
  "type": "Join",
  "token": String # Channel access token
}
```

### `Attendance`
Whenever a user joins or leaves a channel, this structure is sent to all channel participants. It is used so participants can track who is currently in the channel.
```
{
  "type": "Attendance",
  "joined": String[], # An array of UserIDs that have just joined
  "left": String[], # An array of UserIDs that have left
}
```

### `Leave`
Used when a client wishes to cleanly leave the voice channel.
```
{
  "type": "Leave"
}
```

### `Status`
Used to hold status updates. Will mainly contain status values `success` or `error` along with a message.
```
{
  "type": "Status",
  "status": String, # Currently either "success" or "error"
  "Message"?: String # (Optional) A message indicating the reason for a status
}
```

## Flows:
### (start here) Join Channel flow
1. CLIENT: Create a channel access token from POST `/guilds/.../channels/.../token`
2. CLIENT: Send the token to the `/voice` endpoint using the `Join` structure.
3. SERVER: Responds with a `Status` structure.
4. CLIENT: If the `status` field is `"success"`, generate an outbound WebRTC audio stream and initiate the "Re/establish stream flow"

### Re/establish stream flow.
Either end of the connection can initiate this flow any time after the channel is joined. The entity who initiats the flow is called the initiator (labeled INITR), the other entity is called the responder (labeled RESPR). Once this flow is started, either side may send ice candidates using the `IceCandidate` structure.
1. INITR: Generate a WebRTC offer and send it using the `Offer` structure.
2. RESPR: Generate a WebRTC answer and send it using the `Answer` structure.

### Attendance flow
This flow can be initiated by the server at any point after establishing a stream. It is used so that clients can keep track of who else is in the channel with them.
1. SERVER: Send a `UsersJoined` structure with a list of the new users.
2. CLIENT: Update internal user list from the `UsersJoined` structure.

### Leave flow:
This flow can be initiated by the client to gracefully leave a channel at any point after joining.
1. CLIENT: Send a `Leave` structure
2. SERVER: Send a `Status` structure with `status:"success"`
3. Both sides close the connection.

# Live Messages: `/live`
### Note:
The live endpoint uses websockets rather than HTTP methods. The documentation is a little less structured here, as the data has a two-way flow.

## Data structures:
### `Join`
Used to join a voice channel given a channel token.
```
{
  "type": "Join",
  "token": String # Channel access token
}
```

### `Leave`
Used when a client wishes to cleanly leave the voice channel.
```
{
  "type": "Leave"
}
```

### `Status`
Used to hold status updates. Will mainly contain status values `success` or `error` along with a message.
```
{
  "type": "Status",
  "status": String, # Currently either "success" or "error"
  "Message"?: String # (Optional) A message indicating the reason for a status
}
```

### `Messages`
Used to receive messages in real time.
```
{
  "type": "Messages",
  "messages": [ # An arrray of message structs
    {
      "_id": String,
      "authorID": String,
      "channelID": String,
      "content": String
    },
    ...
  ]
}
```

### `NameChange`
Used to (roughly) sync user name changes across clients
```
{
  "type": "NameChange",
  "userID": String, # The ID of the user who's name was changed
  "friendlyName": String, # The new friendlyName of the user
}
```
Note:
The internal NameChange logic will post the update to any guilds that the user (who changed their name) is a member of. This leaves some edge cases where the user's old name is stored in a client cache:
1. If the user sends a message in a server (and a client caches the username), leaves the server, then changes their name.
2. If the client caches the user's old name, but is actively connected to a separate guild when the NameChange event fires. This could be fixed by clearing the user cache whenever the client switches guilds.

## Flows:
### Join Channel flow:
Used to subscribe to updates in a particular channel.
1. CLIENT: Create a channel access token from POST `/guilds/.../channels/.../token`
2. CLIENT: Send access token in `Join` structure
3. SERVER: Responds with `Status` structure.

Note: We don't currently have error status handling designed, nor anything that requires success status handling for this endpoint.

### Message Received flow:
Used to received messages in a particular channel.
1. SERVER: Sends a `Messages` structure containing new messages.
2. CLIENT: Inserts the messages into its chat history

### User Name Changed flow:
Used to update the friendlyName of a user across clients.
1. SERVER: Sends a `NameChange` structure containing the new username.
2. CLIENT: Inserts the new name into its user cache, potentially overwriting the old name.

### Leave Flow:
Used to gracefully unsubscribe to a channel.
1. CLIENT: Send a `Leave` structure.
2. SERVER: Responds with a `Status` structure.
3. Both sides close the connection.

## Business Logic
