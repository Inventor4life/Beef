# Sprint 2 - Due April 4th, 2026
## Introduction
This is an initial document for planning out our sprint 2. This document will evolve over time as we get more experience in what a sprint-preemptive document should look like. Future changes are separated into two categories: Required changes are changes that MUST be implemented for the sprint to be successful; Preferred changes are changes that SHOULD be implemented by the end of the sprint if time allows.

## User stories (Required - summary)
As a logged in User:
 - I can view what guilds I am a member of
 - I can select a guild to see available message channels
 - I can select a channel to view current messages
 - I can scroll up to view historical messages in a channel
 - I can switch between channels in a sidebar
 - I can send messages in a channel in real time

## User stories (Preferred - summary)
As a logged in User:
 - I can update my profile and account settings
 - I can create a guild
 - I can invite others to my guild with a link
 - I can join a guild with a link
 - I can leave a guild

## Required changes
 - Create `User` collection in mongodb with the following fields:
 ```
 {
    "friendlyName": String, # The User's display name
    "_id": NumberLong, # Stores the user's snowflakeID and uses it as the primary key. Gemini says NumberLong is the correct type, but this has not been verified. Only constraint is the type must be able to store 64 bits.

    "guildMemberships": [
        {
            "snowflakeID": NumberLong, #ID of guild
        },
        {
            "snowflakeID": NumberLong,
        }
        # ... A list of the IDs of all guilds the user is a member of.
    ]
 }
 ```
 - Create `Guild` collection in mongodb with the following fields:
 ```
 {
    "friendlyName": String, # The Guild's display name
    "_id": NumberLong, # Same as above, uses Guild snowflake as primary key.
    "members": [
        {
            "snowflakeID": NumberLong, #_id of User
        },
        {
            "snowflakeID": NumberLong,
        }
        # ... A list of all members of a guild
    ]
    "channels": [
        {
            "snowflakeID": NumberLong, #_id of Channel
        },
        {
            "snowflakeID": NumberLong,
        }
        # ... A list of all members of a guild
    ]
 }
 ```
## Preferred changes

## General UI
## Required API
## Unsure additions
