# User Stories

## As a User

- I can log in

## As a Logged In User

- I can view what guilds I am a member of
- I can see my private message channels
- I can select a guild to see available message channels
- I can select a channel to view current messages
- I can scroll up to view historical messages in a channel
- I can select a guild to see online members in that guild *(maybe?)*
- I can update my profile and account settings
- I can create a server
- I can invite others to my server with a link
- I can join a server with a link
- I can leave a server
- I can switch between channels in a sidebar
- I can send messages in a channel in real time

## As a Guild Administrator

- I have all management permissions (Kick, Ban, Mute…) within the guild
- I can edit the server name and channel
- I can create text and voice channels in a server
- I want to edit or delete channels

---

# Stretch Goals

> Goals we may implement if we have time. Services should be designed around later accommodating these goals.

- **Requirements:** Goals we will be implementing
- **Dummy Requirements:** Requirements that are easy to fulfill and prototype to enhance parallel deployment (e.g. a dummy auth service that can take any UserID and register it, without actual OIDC authentication)

## User Self-Management

- Users can log in
- Users can set/change their username

## Guild Management

- Users may create/delete guilds
- Guild Owners may set 2FA to be required to delete the guild
- Guild Owners can name/rename guilds
- Guild Owners can create/delete/name/rename voice and text channels
- Guild Owners can create/delete invite links to send to other people

## Guild Membership Management

- Guild Owners can kick/ban Users from guilds
- Users can join/leave guilds

## Basic Functionality

- Users can select a guild to see available channels
- Users can select a channel to see available messages
- Users can send messages in channels
- Users can see messages sent in channels by other users
- Users can join voice channels in Guilds
- Users can hear other Users in voice channels

## Foreign User Management

- Users can control the volume of other users in voice channels
- Users can block other Users to not see messages from them
- Users can see a list of blocked users and choose to unblock them