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
 - Rather than having a dedicated "channels" collection, each guild
 will contain a list of all channels present and their snowflake. This means that we do not have to choose between cross-cutting channel-rename logic or having to deal with requests dedicated to retrieving a channel name from an ID.

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

    "friendlyName": String, # The User's display name

    "guildMemberships": String[] # A list of the IDs of all guilds the user is a member of.
 }
 ```
 An individual instance of this structure is called a `User` in this document.

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

 - Update the `Messages` collection in mongodb with the following fields:
```
{
    "_id": String, # The Message's snowflake
    "channelID": String, # Snowflake of channel
    "authorID": String, # Snowflake of author
    "content": String, # Message content
}
```
An individual instance of this structure is called a `Message` in this document.

---
---
# API - Required
## Users
> GET `/users/me`

Returns the `User` structure for the currently logged-in user.

### Preconditions:
 - User must be signed in.

### Error codes:
| Code | Cause                      |
|------|----------------------------|
|`200` | Success                    |
|`401` | User is not signed in      |
|`503` | Cannot connect to database |
|`500` | Other error                |
---
---
> GET `/users/{userID}/short`

Returns the `User` structure that matches the requested ID. This method should be used by the front end to display the author of a given message.

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

### Notes:
This will eventually be modified to only return the user's userID, friendlyName, and profileImageURL. Ideally the frontend shouldn't have access to other `User`'s structures, as it allows any user to see what guilds another user is part of in addition to other potentially sensitive information.

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
|`201` | Success                    |
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
## Frontend:
> `/`

Display a simple welcome page with a "Sign in with Google" button. The Log In button should have a redirect uri of `/chat`

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
