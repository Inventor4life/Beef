# Sprint 3 - Due April 25th, 2026

# Introduction

This document details the changes that should be completed over sprint 3. It may change over time as development continues and new information is encountered.

# User stories

- I can scroll up to view historical messages in a channel
- I can create a guild
- I can invite others to my guild with a link
- I can join a guild with a link
- I can receive messages in a channel in real time
- I can join a voice channel and hear other users in the channel

As a guild owner:

- I can create text and voice channels in a server

# General Changes

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
   "type": String, # The type of channel. Currently either "Voice" or "Text".
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

| scope     | description                                                |
| --------- | ---------------------------------------------------------- |
| `user`    | standard user token                                        |
| `service` | service token, can access business-logic-related endpoints |

## Business Logic Update:

Business logic for API endpoints is now listed with the documentation for that API endpoint. Business logic for the frontend is listed at the end of this document. Changes to the business logic of preexisting API endpoints will be marked with `add:`, `remove:`, or `change:` followed by what has changed. Business logic for new API endpoints will not have those fields.

## General Business Logic:

### Generating/Regenerating a service token:

1. Create a `Beef JWT`

2. Set the `scope` field to `service`

3. Leave the `sub` field as an empty string

4. Sign it using the global `secretKey`

### Validating a Beef JWT / Verifying scope

1. Retrieve the `Beef JWT` token stored in the `user_token` header cookie

2. Validate it using the provided `secretKey` global and the JWT library

3. If the above step failed, return status `401` and stop.

4. If a scope is requred, verify that the space-delimited `scope` field of the JWT contains the required `scopes` (or meets the criteria defined by the endpoint requiring a specific scope)

5. If the above step failed, return status `403` and stop.

### Retrying an endpoint:

Because our services-scoped `Beef JWT` to authorize actions, we will occasionally (Every 15 minutes) have to refresh the `Beef JWT`. If an endpoint requiring a `Beef JWT` returns status `401`, regenerate the `Beef JWT` and try the request again. 

### API parameter validity:

We haven't completely specified what some "acceptable" datatypes are (such as `guildID`s not containing letters). Until we do that, it is expected that our API endpoints verify that all parameters are at least _present_ (unless explicitly marked as optional).

# API

## Auth

> POST `/auth`

Accepts a JWT signed by google in the header, sets a Beef JWT header cookie for the relevant user, under the `user_token` name. This endpoint is currently only queried by the Google Identity Services library and requires no front-end configuration. Redirects the user to `#/success` when finished. 

### Preconditions:

- User must have logged in via Google.

### Status codes:

| Code  | Cause                      |
| ----- | -------------------------- |
| `200` | Success                    |
| `401` | Invalid Token              |
| `500` | Other error                |
| `503` | Cannot connect to database |

### Changes from last version:

Auth now redirects to `#/success` rather than `#/chat`. Auth also adds the `user` scope to user tokens.

### Business Logic:

#### Standard flow (begin here):

1. Validate the CSRF fields (one in the header, one in the body. Make sure they match)

2. Validate Google's signature on the token (using the GIS library)

3. Return status `401` if either of those steps failed, then stop.

4. GET `/users?oidcSub={google's sub ID}`

5. If status `404` is received, go to the `Create User` flow.

6. If status `200` is received, go to the `Assign Token` flow.

7. If any other status is received, return an error `500`, log the status and message, then stop.

#### Create User flow:

1. Send a POST request to `/users` containing the `oidcSub` from the `Standard Flow` in the body.

2. If status `201` is received, use the returned `User` information in the `Assign Token` flow.

#### Assign Token flow:

1. Create a `Beef JWT` with the returned `User` information.

2. `Change:` Set the `scope` field to `user`.

3. Sign the token with the `secretKey` global.

4. Set the token as a header cookie with `Secure; Same-Site: Strict; HttpOnly` options. 

5. `Change:` Redirect the user to `#/success`

6. If any of those steps failed, return a status `500`, log the status/message, then stop.

#### Changes:

- The `Beef JWT` `scope` field is now set to `user`.

- The user is now redirected to `#/success` instead of `#/chat`

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
| --------- | ------------------------------------------------- |
| `userID`  | The snowflakeID (as a string) of the desired user |

### Status codes:

| Code  | Cause                      |
| ----- | -------------------------- |
| `200` | User is already in guild   |
| `201` | Successfully added guild   |
| `401` | Invalid Token              |
| `403` | Permission denied          |
| `404` | User not found             |
| `409` | User guild limit exceeded  |
| `500` | Other error                |
| `503` | Cannot connect to database |

### Business Logic:

#### Standard flow (begin here):

1. `Change:` Validate/Verify the `Beef JWT` with scope `service`

2. Query the database for the provided `userID`

3. If no `User` is found, returns status `404` and stop.

4. If the query failed for other reasons, return status `503` and stop.

5. If the `User's` `guildMemberships` array already contains the new `guildID` from the body, return status `200` and stop.

6. Verify that the number of guilds the user is currently enrolled in (the size of the `User`'s `guildMemberships` array) would not exceed our user guild membership limit.

7. Return status `409` if joining the guild would exceed the limit, then stop.

8. Otherwise, use mongoose's `updateOne` method to `$push` the new guild into the membership stack.

9. If step 8 failed or another error occurs, return status `500` and stop.

10. Otherwise, return status `201` and stop.

#### Changes:

- We now check for the `service` scope in the `Beef JWT`

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

| Code  | Cause                                         |
| ----- | --------------------------------------------- |
| `201` | Resource Created                              |
| `400` | Invalid request (missing or malformed fields) |
| `401` | Missing Auth token                            |
| `403` | Permission Denied                             |
| `500` | Other error                                   |
| `503` | Cannot connect to database                    |

### Changes from last version:

The `friendlyName` parameter is now optional. If not included, the service will generate one for you. Using this endpoint now requires the `service` scope.

### Business logic:

#### Standard flow (start here):

1. Validate the `Beef JWT` and verify that it contains the `service` scope

2. Verify that the `oidcSub` field is present in the request body.

3. `Change:` If the `friendlyName` parameter is present, verify that it complies with our `User` name requirements.

4. If steps 2 or 3 failed, return error `400` and stop.

5. `Add:` If the `friendlyName` parameter is not present, auto-generate a friendly name (the exact details of this is left to the implementer. The friendlyNames should generally be unique, but some overlap is acceptable.)

6. Generate a snowflakeID for the user.

7. Insert the user into the database with the current `oidcSub`, `friendlyName`, and `_id`

8. If the above step failed, log the failure, return status `503`, and stop.

9. `Add:` Enroll the user in any starter guilds (if applicable) using the `POST /guilds/.../members` endpoint for each guild.

10. `Add:` For each guild, if the step above succeeds, update the local `User` structure with it's new `guildMemberships`. Note: Do not update the `User` in the database. This step is to avoid having to retrieve the `User` from the database again after adding guild memberships.

11. Return the local `User` structure with status `201` and stop.

12. If any steps above fail (outside of adding the `User` to the global guilds), log the error return status `500`, and stop.

#### Note:

There is an edge-case where adding the `User` to a guild fails, and the `User` is left without a default guild. This is acceptable, as there is no easy workaround given that the `User` has already been inserted into the database.

#### Changes:

- The `friendlyName` field is now optional

- The `friendlyName` field is now validated using the user name rules

- The `User` can now be auto-enrolled in guilds.

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

| Code  | Cause                                         |
| ----- | --------------------------------------------- |
| `200` | Name updated                                  |
| `400` | Invalid request (missing or malformed fields) |
| `401` | Missing Auth token                            |
| `403` | Permission Denied                             |
| `500` | Other error                                   |
| `503` | Cannot connect to database                    |

### Business Logic:

#### Standard flow (start here):

1. Validate `Beef JWT` and verify that it has `user` scope.

2. Verify that the new `friendlyName` conforms with our user naming rules.

3. If not, return status `400` and stop.

4. If so, get the `User` `_id` field from the `Beef JWT` `sub` field.

5. Update the `User` in the database using mongoose's `updateOne()` function

6. Get the `User` from the database

7. Return status `503` if either of those steps failed, then stop.

8. Otherwise, return the updated `User` and status `200`, then stop.

9. If some other error occurs (though I don't think anything else could go wrong), return status `500`

---

---

> GET `/users/me`

Returns the `User` structure for the currently logged-in user.

### Required Scope: `user`

### Preconditions:

- User must be signed in.

### Status codes:

| Code  | Cause                              |
| ----- | ---------------------------------- |
| `200` | Success                            |
| `401` | Invalid token (user not signed in) |
| `403` | Permission Denied                  |
| `404` | User not found                     |
| `500` | Other error                        |
| `503` | Cannot connect to database         |

### Changes from last version:

This endpoint now requires the `user` scope. Will return status `403` if required scope is missing.

### Business logic:

#### Standard flow (start here):

1. `Change:` Validate the `BeefJWT`. Verify that it contains the `user` scope.

2. Query the `_id` field of the `Users` collection using the token's `sub` field.

3. Return status `503` if the query failed, then stop.

4. Return status `404` if the user was not found (this should not happen, ever.), then stop.

5. Return the above `User` structure in the response body with status 200, then stop.

#### Changes:

- Endpoint now requries `user` scope, not just valid token

---

---

> GET `/users/{userID}`

Returns the `User` structure that matches the requested ID. This method should only be used by the back end.

### Required Scope: `service`

### Parameters:

| Parameter | Description                                       |
| --------- | ------------------------------------------------- |
| `userID`  | The snowflakeID (as a string) of the desired user |

### Preconditions:

- User must be signed in.

### Status codes:

| Code  | Cause                      |
| ----- | -------------------------- |
| `200` | Success                    |
| `401` | Missing Auth token         |
| `403` | Permission Denied          |
| `404` | User not found             |
| `500` | Other error                |
| `503` | Cannot connect to database |

### Changes from last version:

This endpoint now requires the `service` scope

### Business Logic:

#### Standard flow (start here);

1. `Change:` Validate the `Beef JWT` and verify that it contains the `service` scope.

2. Query the `Users` collection using the URL's `userID` field.

3. Return status `503` if the query failed, then stop.

4. Return status `404` if there was no matching user, then stop.

5. Otherwise, set the response body to the above `User` structure, return with status `200`, then stop.

#### Changes:

- Endpoint now requires `service` scope, not just a valid token.

---

---

> GET `/users?oidcSub={oidcSubID}`

Returns the `User` structure that matches the requested sub ID. This method should only be used by the backend to query for existing users during sign-in.

### Required scope: `service`

### Response body:

The `User` structure that matches the requested sub ID.

### Parameters:

| Parameter  | Description                             |
| ---------- | --------------------------------------- |
| `?oidcSub` | The OIDC subject ID of the desired user |

### Preconditions:

- The service making the request must present a valid Beef token.

### Status codes:

| Code  | Cause                          |
| ----- | ------------------------------ |
| `200` | Success                        |
| `400` | Invalid (or missing) `oidcSub` |
| `401` | Missing Auth token             |
| `403` | Permission Denied              |
| `404` | User not found                 |
| `500` | Other error                    |
| `503` | Cannot connect to database     |

### Changes from last version:

This endpoint now requires the `service` scope

Business Logic:

### Business Logic:

#### Standard flow (start here);

1. `Change:` Validate the `Beef JWT` and verify that it contains the `service` scope.

2. If the `oidcSub` field is missing, return status `400` and stop.

3. Query the `oidcSub` field of the `Users` collection using the URL's `oidcSub` parameter.

4. Return status `503` if the query failed, then stop.

5. Return status `404` if there was no matching user, then stop.

6. Otherwise, set the response body to the above `User` structure, return with status `200`, then stop.

#### Changes:

- Endpoint now requires `service` scope, not just a valid token.

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

| Code  | Cause                          |
| ----- | ------------------------------ |
| `201` | Success                        |
| `400` | Malformed input (friendlyName) |
| `401` | Missing Auth token             |
| `403` | Permission Denied              |
| `409` | User guild limit exceeded      |
| `500` | Other error                    |
| `503` | Cannot connect to database     |

### Business Logic:

#### Standard Flow:

1. Validate the `Beef JWT`. Verify that it contains scope `user`

2. Validate that the `friendlyName` meets our guild naming rules.

3. If it does not, return status `400` and stop.

4. If it does, create a new `Guild` and set it's `friendlyName` to the value above.

5. Generate a snowflake for the new guild, and set the `Guild`'s `_id` field to it.

6. Using the `Beef JWT` `sub` field call the `POST /users/{userID}/guildMemberships` endpoint and pass it the new snowflake.

7. If the above step failed with status `409`, return status `409` and stop. (discarding the guildID).

8. If the above step failed with a different status: log the status and message, return status `500`, then stop.

9. Set the current `Guild`'s `owner` field to the current `User`'s ID. Also add the user to the `members` list.

10. Insert the new guild into the database.

11. If the insertion failed, return status `503` and stop.

12. Call the `POST /invites` endpoint with the new snowflake to get the invite link.

13. If the above step succeeds, take the invite code and use the `updateOne` method to insert it into the above `Guild` structure. Also, update our local `Guild` structure's `invites` field to append the new invite.

14. If step 10 failed (excluding token regen), log the status and message. If this happens, we will leave the guild without any invites for this sprint.

15. Finally, return the local `Guild` structure with status `201`

### Note:

It is possible that inserting the guild into the database fails, after the user has already updated their `guildMemberships`. Because we haven't yet found a way to sync these changes, this is acceptable. We prefer to add the guild to the user's `guildMemberships` before creating the guild itself, because the `POST /users/.../guildMemberships` endpoint may return status `409` if the user cannot be part of more guilds.

---

---

> POST `/guilds/{guildID}/channels`

Creates a channel within the specified guild. Returns the newly created channel information (friendlyName, type, and _id)

### Preconditions:

- User must be signed in

### Required scope: `user`

### Parameters:

| Parameter   | Description                  |
| ----------- | ---------------------------- |
| `{guildID}` | The ID of the targeted guild |

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

| Code  | Cause                        |
| ----- | ---------------------------- |
| `201` | Success                      |
| `400` | Malformed input              |
| `401` | Missing Auth token           |
| `403` | Permission Denied            |
| `404` | Guild not found              |
| `409` | Guild channel limit exceeded |
| `500` | Other error                  |
| `503` | Cannot connect to database   |

### Note:

The status `403` can be triggered if the requesting user is not the guild owner, not just if a token missing the `user` scope is used.

### Business Logic:

#### Standard Flow (start here):

1. Validate the `Beef JWT`. Verify that it contains scope `user`

2. Verify that the `friendlyName` field meets our channel naming rules.

3. Verify that the `type` field is either `"Voice"` or `"Text"`

4. If steps 2 or 3 fail, return status `400` and stop.

5. Otherwise, query the database using the `guildID` parameter.

6. Return status `503` if the query failed.

7. Return status `404` if there was no matching guild.

8. Verify (from the `Beef JWT` `sub`) that the current `userID` matches the guild's `owner` field.

9. If it does not, return status `403` and stop.

10. Verify that adding the new channel adheres to our guild channel count rules for that type (you will have to count the channels by type.)

11. If it does not, return status `409` and stop.

12. Generate a snowflake for the new channel, and use mongoose's `updateOne` method to `$push` the channel's `_id`, `friendlyName`, and `type` according to the `Guild` data structure definition. 

13. If the update failed, return status `503` and stop.

14. Finally, return the new channel information with status `201`

---

---

> POST `/guilds/{guildID}/members`

Adds a user to a guild. Calls the `/users/.../memberships` API internally to maintain user<->guild linking.

### Required scope: `service`

### Parameters:

| Parameter   | Description                  |
| ----------- | ---------------------------- |
| `{guildID}` | The ID of the targeted guild |

### Request Body:

```
{
  "userID": String # The ID of the user to add to the guild
}
```

### Response Body: None (except error)

### Status codes:

| Code  | Cause                      |
| ----- | -------------------------- |
| `200` | User already in guild      |
| `201` | Success                    |
| `401` | Missing Auth token         |
| `403` | Permission Denied          |
| `404` | Guild or user not found    |
| `409` | User guild limit exceeded  |
| `500` | Other error                |
| `503` | Cannot connect to database |

### Business Logic:

#### Standard flow (start here):

1. Validate the `Beef JWT`. Verify that it contains the `service` scope.

2. Query the `Guild` collection for the specified `guildID`

3. If the query failed, return status `503` and stop.

4. If no guild matched the `guildID`, return status `404` and stop.

5. // If we implemented a guild member limit, we would check it here.

6. Check if the `userID` is present in the guild's `members` array.

7. If so, return status `200` and stop.

8. Call the `POST /users/{userID}/guildMemberships` endpoint with the current `userID` and `guildID`.

9. If that fails with status `404`, return status `404` and stop.

10. If that fails with status `409`, return status `409` and stop.

11. If that fails with any other status, log the status + message, return status `500`, and stop.

12. Otherwise, use mongoose's `updateOne` method to `$push` the `userID` to the current `Guild`'s `members` field.

13. If that fails, return status `503` and stop.

14. Otherwise, return status `201` and stop.

#### Note:

It is possible for the `User`'s `guildMembership` update to work, but then inserting the `userID` into the `memberships` field on the `Guild` side to fail. This is acceptable for this sprint, as it is not an easy problem to correct. It should also be noted that if the user does not have `guildID` in their `guildMemberships` array, but the guild _does_ have the `userID` in their memberships (e.g. DB update failure halfway through calling an API), this endpoint will neither detect nor fix it.

---

---

> GET `/guilds/{guildID}`

Returns the `Guild` structure that matches the requested `guildID`.

### Parameters:

| Parameter | Description                                        |
| --------- | -------------------------------------------------- |
| `guildID` | The snowflakeID (as a string) of the desired guild |

### Required Scope: either `user` or `service`

### Request body: None

### Response body:

The `Guild` structure that matches the `guildID`, or an error.

### Status codes:

| Code  | Cause                      |
| ----- | -------------------------- |
| `200` | Success                    |
| `401` | User is not signed in      |
| `403` | Permission Denied          |
| `404` | Guild not found            |
| `500` | Other error                |
| `503` | Cannot connect to database |

### Changes since last version:

This endpoint will now return status `403` if the requesting user is not a member of the guild. Alternatively, the request is allowed if a token containing the `service` scope is used.

### Business Logic:

#### Standard flow (start here):

1. Validate the `Beef JWT`

2. Query the `Guilds` collection for the `guildID`

3. If the query failed, return status `503` and stop.

4. If no guild matches `guildID`, return status `404` and stop.

5. Otherwise, check if the `Beef JWT` contains the `service` scope. If so, go to step 8

6. Check if the `Beef JWT` contains the `user` scope. If so, get the `userID` from the token's `sub` field.

7. If the `userID` is not present in the `Guild`'s `members` field, return status `403` and stop.

8. Otherwise, return the `Guild` structure with status `200` and stop.

#### Note:

There may be room to improve efficiency here, if needed. Checking if a user is a member of a guild has `O(n)` complexity, because the member's list is unsorted. This could be improved by sorting the list and utilizing binary search.

---

---

> GET `/guilds/{guildID}/short`

Returns the `friendlyName` and `_id` fields of the requested guild.

### Parameters:

| Parameter | Description                                        |
| --------- | -------------------------------------------------- |
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

| Code  | Cause                      |
| ----- | -------------------------- |
| `200` | Success                    |
| `404` | Guild not found            |
| `500` | Other error                |
| `503` | Cannot connect to database |

### Business Logic:

#### Standard flow (start here):

1. Query the `Guilds` collection for the `guildID`

2. If the query failed, return status `503` and stop.

3. If no guild matches `guildID`, return status `404` and stop.

4. Otherwise, return the `_id` and `friendlyName` of the `Guild` structure with status `200` and stop.

---

---

> GET `/guilds/{guildID}/channels/{channelID}/messages?beforeID={oldest}`

Returns an array of up to 50 `Message`s in the channel. Will return the most recent 50 if `beforeID` is not specified, or the 50 messages leading up to `beforeID` if it is.

### Parameters

| Parameter   | Description                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------------- |
| `guildID`   | The snowflakeID (as a string) of the relevant guild                                                 |
| `channelID` | The snowflakeID (as a string) of the relevant channel                                               |
| `?beforeID` | (Optional) The desired message to get other messages prior to. Used for getting historical messages |

### Preconditions:

- User must be signed in.

### Required Scope: `user`

### Error codes:

| Code  | Cause                      |
| ----- | -------------------------- |
| `200` | Success                    |
| `401` | User is not signed in      |
| `403` | Permission Denied          |
| `404` | Guild or channel not found |
| `500` | Other error                |
| `503` | Cannot connect to database |

### Notes:

Status `403` is sent when the requesting user is not a member of the guild

### Changes since last version

Status `403` is returned when the requesting user is not a member of the guild. This endpoint now requires the scope `user`.

### Business Logic:

#### Standard Flow (start here):

1. `Change:` Validate the `Beef JWT`. Verify that it contains the `user` scope.

2. Query the database to make sure that the `guildID` exists, 

3. Return `503` if the query failed, and stop.

4. Return `404` if the guild was not found.

5. `Add:` Check that the `userID` from the `Beef JWT` `sub` field is in the `Guild`'s member list.

6. `Add:` Return status `403` if not.

7. Check that the returned `Guild` contains the requested channel.

8. Return `404` if the channel was not found.

9. If the `?beforeID` parameter is present:

10. Query the database for up to 50 messages in the provided `channelID` with an `_id` less than the given value

11. Otherwise query the database for up to 50 of the most recent messages in the provided channel.

12. Return `503` if the query failed

13. Set the response body to be an array of the `Message` structures returned by the database, even if there are none. Set the status to `200` and stop.

#### Changes:

- This endpoint now requires the `user` scope.

- This endpoint will return error `403` if the current `User` is not a member of the guild.

---

---

> POST `/guilds/{guildID}/channels/{channelID}/messages`

Creates a message in the desired channel. Returns the `Message` structure created.

### Preconditions:

- User must be signed in.

### Required Scope: `user`

### Parameters:

| Parameter   | Description                                           |
| ----------- | ----------------------------------------------------- |
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

| Code  | Cause                      |
| ----- | -------------------------- |
| `201` | Resource Created           |
| `400` | Malformed input            |
| `401` | User is not signed in      |
| `403` | Permission Denied          |
| `404` | Guild or channel not found |
| `500` | Other error                |
| `503` | Cannot connect to database |

### Changes since last version:

Status `403` is now returned if the user is not in the guild. Status `400` is returned if the message is empty or too long. The scope `user` is now required to use the endpoint.

### Notes:

Status `403` should be returned if the current user is not a member of the requested guild.

### Business Logic:

#### Standard flow (start here):

1. `Change:` Validate the Beef token. Verify that it contains the `user` scope.

2. Verify that the `content` field complies with our message content rules.

3. If not, return status `400` and stop.

4. Query the `Guilds` collection for `guildID`.

5. If the query failed, return status `503` and stop.

6. If no `Guild` matches `guildID`, return status `404` and stop.

7. `Add:` Check that the `userID` from the `Beef JWT` `sub` field is in the `Guild`'s member list.

8. `Add:` Return status `403` if not.

9. Check that the returned `Guild` contains the requested channel.

10. Return `404` if the channel was not found.

11. Generate a snowflakeID for the message.

12. Create a `Message` structure from the `channelID`, `userID`, `content`, and snowflake.

13. Insert the message structure into the `Messages` collection.

14. If the insertion failed, return status `503` and stop.

15. Otherwise, return the generated `Message` structure with code `201`.

#### Changes:

- This endpoint now requires the `user` scope.

- This endpoint will return status `403` if the current `User` is not a member of the `Guild`

---

---

> POST `/guilds/{guildID}/channels/{channelID}/token`

Issues a `Channel token` that will allow the user to access the channel's WebSocket interface.

### Preconditions:

- User must be signed in.

### Required Scope: `user`

### Parameters:

| Parameter   | Description                                           |
| ----------- | ----------------------------------------------------- |
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

| Code  | Cause                      |
| ----- | -------------------------- |
| `201` | Resource Created           |
| `401` | User is not signed in      |
| `403` | Permission Denied          |
| `404` | Guild or channel not found |
| `500` | Other error                |
| `503` | Cannot connect to database |

### Notes:

Status `403` should be returned if the current user is not a member of the requested guild, or if the `user` scope is not present.

These tokens are used to access the websocket interface of that channel.

### Business Logic:

1. Validate the `Beef JWT`. Verify that it contains the `user` scope.

2. Query the `Guilds` collection for the provided `guildID`

3. If the query failed, return status `503` and stop.

4. If no guild matches `guildID`, return status `404` and stop.

5. Get the `userID` from the `Beef JWT`'s `sub` field, and verify that it is present in the `Guild`'s `members` array.

6. If it is not, return status `403` and stop.

7. Verify that the requested `channelID` is present in the `Guild`'s `channels` array.

8. If it is not, return status `404` and stop.

9. Otherwise, create a `Channel Token` from the `channelID`, `guildID`, channel type, and `userID`. Sign it with the `secretKey` global.

10. Return the created `Channel Token` in the request body with status `201` and stop.

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

| Code  | Cause                      |
| ----- | -------------------------- |
| `201` | Success                    |
| `401` | Missing Auth token         |
| `403` | Permission Denied          |
| `500` | Other error                |
| `503` | Cannot connect to database |

### Business Logic:

#### Standard flow (start here):

1. Validate the `Beef JWT`. Verify that it contains the `service` scope.
2. Generate a snowflakeID for the new invite.
3. Create an `Invite` structure with the snowflake and the `guildID`
4. Insert the `Invite` into the `Invites` collection.
5. Return status `503` if that failed, then stop.
6. Return the `Invite` `_id` (as `inviteCode`) and `guildID` with status `201`, then stop.

---

---

> GET `/invites/{inviteCode}`

Get the guildID associated with a particular invite.

### Parameters:

| Parameter    | Description                           |
| ------------ | ------------------------------------- |
| `inviteCode` | The code of the desired invite to get |

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

| Code  | Cause                      |
| ----- | -------------------------- |
| `200` | Success                    |
| `404` | Invite not found           |
| `500` | Other error                |
| `503` | Cannot connect to database |

### Business Logic:

#### Standard flow (start here):

1. Query the `Invites` collection for the `inviteCode`

2. If the query failed, return status `503` and stop.

3. If no invite matches `inviteCode`, return status `404` and stop.

4. Otherwise, return the `Invite` structure with status 200 and stop.

---

---

> POST `/invites/{inviteCode}`

Accept an invite, joining the guild.

### Parameters:

| Parameter    | Description                            |
| ------------ | -------------------------------------- |
| `inviteCode` | The code of the desired invite to use. |

### Preconditions:

- User must be signed in

### Required scope: `user`

### Request Body: None

### Response Body: None (except error)

### Status codes:

| Code  | Cause                      |
| ----- | -------------------------- |
| `200` | User already in guild      |
| `201` | Success                    |
| `401` | Invalid token              |
| `403` | Permission denied          |
| `404` | Invite or guild not found  |
| `409` | User guild limit exceeded  |
| `500` | Other error                |
| `503` | Cannot connect to database |

### Business Logic:

#### Standard Flow (start here):

1. Validate the `Beef JWT`. Verify that it contains the `user` scope.

2. Query the `Invites` collection for the `inviteCode`

3. If the query failed, return status `503` and stop.

4. If there is no matching `Invite`, return status `404` and stop.

5. Get the `guildID` from the `Invite` and call `POST /guilds/{guildID}/members`

6. If status `200`, return status `200` and stop.

7. If status `201`, return status `201` and stop.

8. If status `404`, return status `404` and stop.

9. If status `409`, return status `409` and stop.

10. If another status is returned (other than token refresh): Log the status + message, return status `500`, and stop.

---

---

## Live:

> POST `/live/messages`

Queue a message to users connected via WebSocket. Does not verify the content within the message.

### Required scope: `service`

### Request Body:

The `Message` structure to be sent.

### Response Body: None (except error)

### Status codes:

| Code  | Cause             |
| ----- | ----------------- |
| `201` | Success           |
| `400` | Malformed input   |
| `401` | Invalid token     |
| `403` | Permission denied |
| `500` | Other error       |

### Business Logic:

#### Standard flow:

1. Validate the `Beef JWT`. Verify that it contains the `service` scope.

2. Verify that the `Message` structure contains all the components expected of a `Message` structure. If not, return status `400` and stop.

3. Get the `channelID` from the `Message` structure.

4. Query the Live service Channel map (created in the `/live` websocket endpoint) for the array of messages waiting to be sent.

5. Append the current `Message` structure to the array.

6. Return status `201` and stop.

---

---

> POST `/live/name-change`

Queue a nameChange update to users connected via WebSocket.

### Required scope: `service`

### Request Body:

The new `User` structure of the user whose name was changed (including guildMemberships)

### Response Body: None (except error)

### Status codes:

| Code  | Cause                      |
| ----- | -------------------------- |
| `201` | Success                    |
| `400` | Malformed input            |
| `401` | Invalid token              |
| `403` | Permission denied          |
| `500` | Other error                |
| `503` | Cannot connect to database |

### Business Logic:

#### Standard flow (start here):

1. Validate the `Beef JWT`. Verify that it contains the `service` scope.

2. Verify that the `User` structure contains `_id`, `guildMemberships`, and `friendlyName`. If not, return status `400` and stop.

3. Create a `nameChange` data structure (as defined for the `/live` endpoint)

4. For each `guildID` in the `guildMemberships` array:
   
   1. Use the Guild-channels[] map (created in the `/live` websocket endpoint) to obtain the channels in that guild with active websockets
   
   2. For each `channel`, put the `nameChange` event into the event queue for that channel.
- Return status `201` and stop.

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

1. SERVER: Send an `Attendance` structure with a list of the new users.
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

# Front end Business Logic
