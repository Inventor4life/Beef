# Sprint 2 - Due April 4th, 2026
## Introduction
This is an initial document for planning out our sprint 2. This document will evolve over time as we get more experience in what a sprint-preemptive document should look like. Future changes are separated into two categories: Required changes are changes that MUST be implemented for the sprint to be successful; Preferred changes are changes that SHOULD be implemented by the end of the sprint if time allows.

## User stories - Required
As a logged in User:
 - I can view what guilds I am a member of
 - I can select a guild to see available message channels
 - I can select a channel to view current messages
 - I can scroll up to view historical messages in a channel
 - I can switch between channels in a sidebar
 - I can send messages in a channel in real time


---
---
# General Changes - Required
 - Rather than having a dedicated "channels" collection, each guild will contain a list of all channels present and their snowflake. This means that we do not have to choose between cross-cutting channel-rename logic or having to deal with requests dedicated to retrieving a channel name from an ID.

 - Rather than having a dedicated "messages" service, each guild will be in charge of managing messages to its own channels. This will need to be changed to a dedicated service if we wish to allow direct messaging in the future, or hack it by having a "direct message" guild where users can only see specific channels.

 - Snowflake IDs should be stored as strings that are padded with `0`s to be of length 20. While this increases the storage requirements of a snowflake ID, it eliminates the need to convert the snowflake IDs to BigInts, NumberLongs, or anything else (and back, for API calls)

 - When sending an API call, the leading `0`s in the snowflakeID can be ommitted. The recipient should pad the received snowflake to the required length.

 - All collections should be sorted by `_id` in ascending order. Ideally, Messages requested by the client through the API should also be in ascending order.

---
---
# Data structures - Required
 - Create `Users` collection in mongodb with the following fields:
 ```
 {
    "_id": String, # Stores the user's snowflakeID and uses it as the primary key. Must be left-padded with "0"s to a length of 20 characters
    
    "oidcSub": String, # The ID given to use by the OIDC provider. Used to log the user in.
    
    "friendlyName": String, # The User's display name

    "guildMemberships": String[] # A list of the IDs of all guilds the user is a member of.
 }
 ```
 An individual instance of this structure is called a `User` in this document. Because `Users` need to be searchable by both their `_id` and `oidcSub`, please create a compound index in mongoDB that uses both.

 - Create a `Guilds` collection in mongodb with the following fields:
 ```
 {
    "_id": String, # Same as above, uses Guild snowflake as primary key.

    "friendlyName": String, # The Guild's display name
    
    "members": String[], # A list of snowflakeIDs of guild members
    
    "channels": [
        {
        "friendlyName": String, # The Channel's display name
        "_id": String, # The Channel's SnowflakeID
        }
    ]
 }
 ```
An individual instance of this structure is called a `Guild` in this document.

 - Set the `Messages` collection in mongodb to have the following fields:
```
{
    "_id": String, # The Message's snowflake
    "channelID": String, # Snowflake of channel
    "authorID": String, # Snowflake of author
    "content": String, # Message content
}
```
An individual instance of this structure is called a `Message` in this document. Because Messages need to be searchable by both their `_id` and `channelID`, please create a compound index in mongoDB that uses both.

 - The Beef JWTs will have the following structure:
```
{
    "aud": String, # Will always be "Beef" for our Beef tokens
    "sub": String, # The user's Beef ID. Will be empty for service tokens
    "iat": Number, # When the token was issued
    "exp": Number, # When the token expires
    "iss": String, # Whoever signed the token. Will be "Auth" for the near future.
}
```

---
---
# API - Required
## Users
> POST `/auth`

Accepts a JWT signed by google in the header, returns a Beef JWT for the relevant user. This endpoint is currently only queried by the Google Identity Services library and requires no front-end configuration. Redirects the user to the `/chat` endpoint when finished.

### Preconditions:
 - User must have logged in via Google

### Error codes:
| Code | Cause                      |
|------|----------------------------|
|`200` | Success                    |
|`401` | Invalid Token              |
|`503` | Cannot connect to database |
|`500` | Other error                |

---
---

> GET `/users/me`

Returns the `User` structure for the currently logged-in user.

### Preconditions:
 - User must be signed in.

### Error codes:
| Code | Cause                      |
|------|----------------------------|
|`200` | Success                    |
|`400` | Malformed user token       |
|`401` | User is not signed in      |
|`404` | User not found             |
|`503` | Cannot connect to database |
|`500` | Other error                |
---
---
> GET `/users/{userID}/short`

Returns the `userID` and `friendlyName` of the `User` structure that matches the requested ID. This method should be used by the front end to display the author of a given message.

### Parameters:
| Parameter | Description                                       |
|-----------|---------------------------------------------------|
| `userID`  | The snowflakeID (as a string) of the desired user |

### Preconditions:
 - User must be signed in.

### Error codes:
| Code | Cause                      |
|------|----------------------------|
|`200` | Success                    |
|`401` | User is not signed in      |
|`404` | User not found             |
|`503` | Cannot connect to database |
|`500` | Other error                |

---
--- 
> GET `/users/{userID}`

Returns the `User` structure that matches the requested ID. This method should only be used by the back end.

### Parameters:
| Parameter | Description                                       |
|-----------|---------------------------------------------------|
| `userID`  | The snowflakeID (as a string) of the desired user |

### Preconditions:
 - User must be signed in.

### Error codes:
| Code | Cause                      |
|------|----------------------------|
|`200` | Success                    |
|`401` | Missing Auth token         |
|`403` | Not a backend service      |
|`404` | User not found             |
|`503` | Cannot connect to database |
|`500` | Other error                |

### Notes:
Error 403 will not be implemented for this sprint (except as a stretch goal). It requires us to have a reliable way to generate authentication tokens for individual services, and the added security is not currently necessary.

---
---

> GET `/users?oidcSub={oidcSubID}`

Returns the `User` structure that matches the requested sub ID. This method should only be used by the backend to query for existing users during sign-in.

### Parameters:
| Parameter  | Description                                       |
|------------|---------------------------------------------------|
| `?oidcSub` | The OIDC subject ID of the desired user           |

### Preconditions:
 - The service making the request must present a valid Beef token.

### Error codes:
| Code | Cause                          |
|------|--------------------------------|
|`200` | Success                        |
|`400` | Invalid (or missing) `oidcSub` |
|`401` | Missing Auth token             |
|`403` | Not a backend service          |
|`404` | User not found                 |
|`503` | Cannot connect to database     |
|`500` | Other error                    |

### Notes:
Error 403 will not be implemented for this sprint (except as a stretch goal). It requires us to have a reliable way to generate authentication tokens for individual services, and the added security is not currently necessary.

---
---
> POST `/users`

Creates the user specified in the request body. This method should only be used by the backend to create new users. Returns the created `User` structure.

### Request Body:
```
{
    "oidcSub": String, # The ID given by the OIDC provider
    "friendlyName": String, # The User's display name
}
```

### Response Body:
A `User` data structure with the request information, as well as a unique `_id` and the user's list of guild memberships.

### Precondition
 - The service making the request must present a valid Beef token

### Error codes:
| Code | Cause                      |
|------|----------------------------|
|`201` | Resource Created           |
|`401` | Missing Auth token         |
|`403` | Not a backend service      |
|`503` | Cannot connect to database |
|`500` | Other error                |

### Notes:
Because creating/joining/leaving guilds is not required for this sprint, users will be enrolled in a handful of pre-made guilds.

Error 403 will not be implemented for this sprint (except as a stretch goal). It requires us to have a reliable way to generate authentication tokens for individual services, and the added security is not currently necessary.

---
---

## Guilds

> GET `/guilds/{guildID}`

Returns the `Guild` structure that matches the requested `guildID`.

### Parameters:
| Parameter | Description                                        |
|-----------|----------------------------------------------------|
| `guildID` | The snowflakeID (as a string) of the desired guild |

### Preconditions:
 - User must be signed in.

### Error codes:
| Code | Cause                      |
|------|----------------------------|
|`200` | Success                    |
|`401` | User is not signed in      |
|`404` | Guild not found            |
|`503` | Cannot connect to database |
|`500` | Other error                |

### Notes:
This method doesn't currently support bulk guild operations. This means that the front end will need to make one request per user guild during bootstrap, which will use lots of bandwidth. One option is to use a query parameter with a similar endpoint: GET `/guilds?ids=1,2,3,...` to batch the requests together.

---
---

## Messages:

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

### Error codes:
| Code | Cause                      |
|------|----------------------------|
|`200` | Success                    |
|`401` | User is not signed in      |
|`404` | Guild or channel not found |
|`503` | Cannot connect to database |
|`500` | Other error                |

---
---
> POST `/guilds/{guildID}/channels/{channelID}/messages`

Creates a message in the desired channel. Returns the `Message` structure created.

### Parameters:
| Parameter   | Description                                           |
|-------------|-------------------------------------------------------|
| `guildID`   | The snowflakeID (as a string) of the relevant guild   |
| `channelID` | The snowflakeID (as a string) of the relevant channel |

### Body:
```
{
    "content": String # the content of the message to be created.
}
```

### Preconditions:
 - User must be signed in.

### Error codes:
| Code | Cause                      |
|------|----------------------------|
|`201` | Resource Created           |
|`401` | User is not signed in      |
|`404` | Guild or channel not found |
|`503` | Cannot connect to database |
|`500` | Other error                |

---
---
## Web Pages - Routes, UI
| Route  | Basic UI description        |
|--------|-----------------------------|
|`/`     | Welcome page, Log in button |
|`/chat` | General chat UI             |

### Notes:
This will change in the future. Discord uses the currently active channel as the URL, in the form of
 `/channels/{guildID}/{channelID}` which allows people to copy links to the current channel by just copying a URL. I
 (@Inventor4life) do not know enough about React to comment on how difficult it would be to implement that.

# Business Logic (by service):
### Note:
The user's ID takes several forms (unfortunately) due to conflicting id requirements in mongoDB and JWTs. A userID in a JWT is in the `sub` field. A user ID in the `Users` collection is in the `_id` field. A user ID in the `Messages` collection is in the `authorID` field. For all APIs and business logic, it is referred to as the `userID`.

## Frontend:
> `/`

Display a simple welcome page with a "Sign in with Google" button. The Log In button should have a redirect uri of `/chat`

---

> `/chat`

For any of the below requests, a response status of `401` should result in the user being redirected to `/` to log in.

### On page load:
`GET /users/me` to get the current user's list of guilds. The user's `friendlyName` may also be used to show the user who they are logged in as.

For every guild in the list, call `GET /guilds/{currentGuildID}` to get a name to go with the guild ID. The ID of the very first guild should be set as the user's `activeGuildID`. All of the guilds in the list should be accessible via buttons in the left side bar, preferrably with the guild name. In the future, the api will be changed to add a bulk name-only endpoint so that we send one request total, rather than one requests per guild.

### After setting the `activeGuildID`
This will occur whenever the user selects a new guild in the left side bar, and on page load. Use `GET /guilds/{activeGuildID}` to get the active guild's available channels. These channels should be accessible from an inset left side bar so that users can select a different channel or a different guild without having to open/close other menues. Set the first channel as the user's `activeChannelID` and use that for all future message-related requests.

### After setting the `activeChannelID`
This will occur whenever the user selects a new guild in the left side bar or a new channel in the left sidebar. `GET /guilds/{activeGuildID}/channels/{activeChannelID}/messages` should be called to get the initial messages in the guild (rather than making the user wait for the next message poll).

### After messages have been received:
Our current message structure does not have an `authorFriendlyName` field; they are all authored by IDs rather than usernames. This has been done to make it easier to update messages in the event that the author changes their username. The frontend should have a cache (or just a map for now) that handles `userID -> friendlyName` conversions and calls `GET /users/{userID}/short` whenever we have a cache miss. This step should be included automatically in the logic that handles `message data structure -> UI element representing the message`

### Every second after page load, while the user is viewing the live feed:
Because scrolling historical messages involves the same api endpoint as getting live messages, we should have a boolean variable called liveFeed (or something similar) that (when true) causes us to poll the `GET /guilds/{activeGuildID}/channels/{activeChannelID}/messages` endpoint every second. This variable should not be a physical button for the user, and should rather be set to true on page load, whenever `activeMessageID` changes, and whenever the user scrolls to the very bottom (to the most recent messages) of the message display window. While it is true the user should be auto-scrolled to the bottom of the window whenever new messages are added, that way new messages don't get pushed off of the screen (and the user can view a live feed without interacting with the website).

It isn't ideal to be polling every second. We should aim to implement WebSockets before the end of the 3rd sprint.

### When viewing historical messages:
If at any point the user scrolls up from the live feed, the liveFeed variable should be set to false and the front end should stop polling for new messages until the user returns to the bottom of the chat feed. While viewing historical messages: Allow the user to scroll up to the oldest message currently stored on the front end in that channel. Once that message has been reached (or some number of buffer messages before hand), use `GET /guilds/{activeGuildID}/channels/{activeChannelID}/messages?beforeID={oldestMessageID}` to get messages older than `oldestMessageID`. These can be prepended to our message array to allow the user to keep scrolling as normal.

### When sending a message:
Send `POST /guilds/{guildID}/channels/{channelID}/messages` with a request body of:
```
{
    "content": {messageContent}
}
```
When the backend returns the finished message structure, give it to your existing message-handling functions to immediately append it to the message queue.

## Presenter:
> GET `/`

Serve our welcome page.

---
> GET `/chat`

Check if the user possesses a valid Beef JWT. Serve the chat page if so. Otherwise, redirect them to `/` so they may log in.

## Backend:

For service authentication tokens:
 - For now, each service will have the ability to mint its own tokens using a shared secret. This will be the same secret that the Auth service uses to mint User tokens, that way each service token functions as a user token until we can set up dedicated service tokens. While this is a huge security risk, we do not currently have the infrastructure to securely authenticate services outside of this method.

For any of the below requests:
 - A received code of `401` in service-to-service communications should have the caller service regenerate its own token and try the request again.

 - A received code of `500` or `503` should be propogated back to the original caller (i.e. a user queries the Auth service to log in, the Auth service queries the Users service. If the Users service returns `503`, the flow should be: Users returns `503` -> Auth service returns `503` -> Client receives `503`).

For verifying authentication tokens:
 - Check first-service's `main.ts` for an example.
 - We use a library to verify:
    - The token is not expired,
    - `aud` == `Beef`, 
    - `iss` == `Auth`,
    - The signature matches

### `Auth` service:
On startup, generate a self-signed service token.

---

> POST `/auth`

 - Validate the CSRF token
 - Validate Google's token
 - Return `401` if either of those steps failed
 - Send GET `/users?oidcSub={google's sub ID}`
 - If `400` is received, return an error `500`
 - If `404` is received, Send POST `/users` with the required data structure to create a user; using the name provided by google's token as the `friendlyName` field.
 - Sign a Beef JWT using the returned `User` information.
 - Set that JWT as a header cookie with `Secure; Same-Site: Strict; HttpOnly` options.
 - Redirect the user to `/chat`

---
---
### `Users` service:
On startup, generate a self-signed service token.

---

> GET `/users/me`

 - Validate the Beef token
 - Return `401` if the token is invalid
 - Return `400` if the token contains a missing or empty `sub` field (i.e. it is a self-signed service token)
 - Query the `_id` field of the `Users` collection using the token's `sub` field.
 - Return `503` if the query failed
 - Return `404` if there was no matching user. Because we need the `_id` from the database to generate the `JWT`, having a `JWT` with a `sub` not present in the database (that isn't a service token) means that something somewhere went seriously wrong.
 - Otherwise, set the response body to be the `User` structure returned by the database

---

> GET `/users/{userID}/short`

 - validate the Beef token
 - Return `401` if the token is invalid
 - Query the `Users` collection using the URL's `userID` field
 - Return `503` if the query failed (timed out, db is offline, etc.)
 - Return `404` if there was no matching user
 - Otherwise, set the reponse body to be the `_id` (as `userID`) and `friendlyName` fields of the `User` structure returned by the database.

---

> GET `/users/{userID}`

Currently, same as above.
 - validate the Beef token
 - Return `401` if the token is invalid
 - Query the `Users` collection using the URL's `userID` field
 - Return `503` if the query failed (timed out, db is offline, etc.)
 - Return `404` if there was no matching user
 - Otherwise, set the reponse body to be the `User` structure returned by the database

---

> GET `/users?oidcSub={oidcSubID}`

Similar to above.
 - validate the Beef token
 - Return `401` if the token is invalid
 - Return `400` if the `oidcSub` parameter is missing or malformed
 - Query the `oidcSub` field of the `Users` collection using the URL's `?oidcSub` parameter.
 - Return `503` if the query failed (timed out, db is offline, etc.)
 - Return `404` if there was no matching user.
 - Otherwise, set the reponse body to be the `User` structure returned by the database

---

> POST `/users`

 - validate the Beef token
 - Return `401` if the token is invalid
 - Validate that the request body contains `oidcSub` and `friendlyName` fields. Return `400` if not. Ignore all extra fields.
 - Generate a snowflakeID for the user
 - Create a new user in the `Users` collection using the generated snowflakeID and the provided `oidcSub` and `friendlyName` fields.
 - Return `503` if the transaction failed (timed out, db is offline, etc.)
 - Return the created user in the response body with code `201`

---
---

### `Guilds` service

On Startup, generate a self-signed user token.

---

> GET `/guilds/{guildID}`

 - validate the Beef token
 - return `401` if the token is invalid
 - Query the `Guilds` collection using the URL's `guildID` field
 - Return `503` if the query failed (timed out, db is offline, etc.)
 - Return `404` if there was no matching guild
 - Otherwise, set the reponse body to be the `Guild` structure returned by the database

--- 

> GET `/guilds/{guildID}/channels/{channelID}/messages?beforeID={oldest}`

 - validate the Beef token
 - return `401` if the token is invalid
 - Query the database to make sure that the `guildID` exists, and then check that the returned `Guild` contains the requested channel.
 - Return `503` if we could not connect to the database.
 - Return `404` if the guild was not found or the channel was not in the guild.
 - if the `?beforeID` parameter is present:
    - Query the database for up to 50 messages in the provided `channelID` with an `_id` less than the given value
    - Otherwise query the database for up to 50 of the most recent messages in the provided channel.
 - Set the response body to be an array of the `Message` structures returned by the database.

Notes:

In the future, we need to check that the `userID` in the Beef token is present in the `Guild` referenced by `GuildID` and return an error `403` if not.

---

> POST `/guilds/{guildID}/channels/{channelID}/messages`

 - validate the Beef token
 - return `401` if the token is invalid
 - Query the database to make sure that the `guildID` exists, and then check that the returned `Guild` contains the requested channel.
 - Return `503` if we could not connect to the database.
 - Return `404` if the guild was not found or the channel was not in the guild.
 - Generate a snowflakeID for the message.
 - Get the `sub` field from the Beef token and set the `authorID` field in the message to that value.
 - Insert the message structure into the `Messages` collection.
 - Return `503` if we could not connect to the database.
 - Otherwise, return the generated `Message` structure with code `201`.

Notes:

In the future, we need to verify the length/content of the message on both the front and back end.


# Preferred changes
## User stories - Preferred
As a logged in User:
 - I can update my profile and account settings
 - I can create a guild
 - I can create channels within a guild
 - I can invite others to my guild with a link
 - I can join a guild with a link
 - I can leave a guild
 - I can view the profile images of guilds and users

## General UI
## Unsure additions
