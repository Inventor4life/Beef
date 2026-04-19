import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireScope } from './middleware.js';
import { getCollection, isDbConnected } from './db.js';
import { generateSnowflake } from './snowflake.js';

const MAXGUILDS = 16

export interface User {
  _id: string,
  oidcSub: string,
  friendlyName: string,
  guildMemberships: string[]
}

const router = Router();

/*
Accepts a structure in the request body of the form
  {
    "oidcSub": String, # The ID given by the OIDC provider
    "friendlyName": String, # The User's display name
  }

Performs a couple of permission/connection tests, then creates a User in mongodb.
Returns the finished user structure if successful
*/
router.post('/users', requireAuth, requireScope("service"), async (req: Request, res: Response)=>{
  // DB connectivity check
  if(!isDbConnected()) {
    res.status(503).json({ error: "database not connected" });
    return;
  }

  const { friendlyName, oidcSub } = req.body;

  // NOTE: If we do any name length checks or filters, they go here.
  if(!friendlyName || !oidcSub ) {
    res.status(400).json({ error: "Missing or malformed friendlyName or oidcSub" });
    return;
  }

  // NOTE: We should probably validate that the oidcSub does not already exist instead of assuming the auth service
  //  does that for us.
  const newUser: User = {
    _id: generateSnowflake(),
    oidcSub: oidcSub,
    friendlyName: friendlyName,
    guildMemberships: [] // We will put default guilds here
  }

  try {
    await getCollection<User>("users").insertOne(newUser)
  } catch(err) {
    console.log("POST /users Error inserting user:", err)
    res.status(500).json({ error: "failed to insert new user into database" });
    return;
  }

  res.status(201).json(newUser);

  // Not really a place to catch a generic error and return code 500.
})

router.get('/users/me', requireAuth, requireScope("user"),async (req: Request, res: Response) => {
  // DB connectivity check
  if (!isDbConnected()) {
    res.status(503).json({ error: "database not connected" });
    return;
  }

  // userID of requesting user, provided by auth middleware in middleware.ts.
  const userID = res.locals.user.sub
  if (!userID || typeof userID !== 'string') {
    // The auth middleware requires a signed JWT. Those JWTs should only be issued by the auth service, which should
    //  always issue an ID (unless it is a service account, which shouldn't call /users/me).
    console.log("GET /users/me missing userId (id, type): ", userID,", ", typeof userID);
    res.status(500).json({ error: "missing userID. This error should not be possible." });
    return;
  }

  try {
    const userResult = await getCollection<User>("users").findOne({_id: userID})
    if(!userResult) {
      // A userID is required to get an issued JWT. This error is an edge-case where an account was deleted
      //  (not banned) while an active JWT existed.
      console.log("GET /users/me user not found: ", userID)
      res.status(404).json({ error: "user not found. This error should not be possible." });
      return;
    }
    res.status(200).json(userResult);
  } catch (err) {
    console.log("GET /users/me general error:", err);
    res.status(500).json({ error: "failed to fetch user"})
  }

});

router.get('/users', requireAuth, requireScope("service"), async (req: Request, res: Response) => {
  // DB connectivity check
  if (!isDbConnected()) {
    res.status(503).json({ error: "database not connected" });
    return;
  }

  const userOidc = req.query.oidcSub
  if (!userOidc || typeof userOidc !== 'string') {
    res.status(400).json({ error: "missing or malformed oidcSub." });
    return;
  }

  try {
    const userResult = await getCollection<User>("users").findOne({oidcSub: userOidc})
    if(!userResult) {
      res.status(404).json({ error: "user not found"});
      return;
    }
    res.status(200).json(userResult);
  } catch (err) {
    console.log("GET /users?oidcSub general error: ", err);
    res.status(500).json({ error: "failed to fetch user"})
  }
});

router.get('/users/:userID/short', requireAuth, requireScope("service"), async (req: Request, res: Response) => {
  // DB connectivity check
  if (!isDbConnected()) {
    res.status(503).json({ error: "database not connected" });
    return;
  }

  // userID should be padded to 20 chars with "0" on the LHS. Can't pad yet because userID may not exist.
  const userIDunpadded = req.params.userID
  if (!userIDunpadded || typeof userIDunpadded !== 'string') {
    res.status(400).json({ error: "missing required route parameter \"userID\"." });
    return;
  }

  const userID = userIDunpadded.padStart(20, "0"); // User ID of user to be searched for
  try {
    const userResult = await getCollection<User>("users").findOne({_id: userID})
    if(!userResult) {
      res.status(404).json({ error: "user not found"});
      return;
    }
    const shortUser = {
      _id: userResult._id,
      friendlyName: userResult.friendlyName
    }
    res.status(200).json(shortUser);
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "failed to fetch user"})
  }

});

router.get('/users/:userID', requireAuth, requireScope("service"),async (req: Request, res: Response) => {
  // DB connectivity check
  if (!isDbConnected()) {
    res.status(503).json({ error: "database not connected" });
    return;
  }

  // userID should be padded to 20 chars with "0" on the LHS. Can't pad yet because userID may not exist.
  const userIDunpadded = req.params.userID
  if (!userIDunpadded || typeof userIDunpadded !== 'string') {
    res.status(400).json({ error: "missing required route parameter \"userID\"." });
    return;
  }

  const userID = userIDunpadded.padStart(20, "0"); // User ID of user to be searched for
  try {
    const userResult = await getCollection<User>("users").findOne({_id: userID})
    if(!userResult) {
      res.status(404).json({ error: "user not found"});
      return;
    }
    res.status(200).json(userResult);
  } catch (err) {
    console.log("GET /users/:userID general error: ", err);
    res.status(500).json({ error: "failed to fetch user"})
  }

});

router.post('/users/:userID/guildMemberships', requireAuth, requireScope("service"), async (req: Request, res: Response) => {
  if (!isDbConnected()) {
    res.status(503).json({ error: "database not connected" });
    return;
  }

  const userIDunpadded = req.params.userID
  if (!userIDunpadded || typeof userIDunpadded !== 'string') {
    res.status(400).json({ error: "missing required route parameter \"userID\"." });
    return;
  }
  const userID = userIDunpadded.padStart(20, "0");

  const { guildID } = req.body
  if (!guildID || typeof guildID !== 'string') {
    res.status(400).json({ error: "missing or malformed required body parameter \"guildID\"." });
    return;
  }

  // Query the database for the provided userID
  let userResult; // needs to be defined in this scope since we need it outside the try-catch block.
  try {
    userResult = await getCollection<User>("users").findOne({_id: userID})
    // If no User is found, returns status 404 and stop.
    if(!userResult) {
      res.status(404).json({ error: "user not found"});
      return;
    }
  } catch (err) {
    // If the query failed for other reasons, return status 503 and stop.
    console.log("POST /users/:userID/guildMemberships error querying user: ", err);
    res.status(503).json({ error: "failed to query user from database" });
    return;
  }

  // If the User's guildMemberships array already contains the new guildID from the body, return status 200 and stop.
  if (userResult.guildMemberships.includes(guildID)) {
    res.status(200).json({ message: "user already a member of this guild" });
    return;
  }

  // Verify that the number of guilds the user is currently enrollled in (the size of the User's guildMemberships array) would not exceed our user guild membership limit
  if (userResult.guildMemberships.length >= MAXGUILDS) {
    // Return status 409 if joining the guild would exceed the limit, then stop.
    res.status(409).json({ error: "user guild membership limit reached" });
    return;
  }

  // Otherwise, use mongoose's updateOne method to $push the new guild into the membership stack.
  try {
    const result = await getCollection<User>("users").updateOne({_id: userID}, {$push: {guildMemberships: guildID}});
    if (result.modifiedCount !== 1) {
      // If previous step failed return status 500 and stop
      console.log("POST /users/:userID/guildMemberships error updating user guild memberships: ", result);
      res.status(500).json({ error: "failed to update user guild memberships" });
      return;
    }
    // Otherwise, return status 201 and stop.
    res.status(201).end();
    // if another error occurs return status 500 and stop
  } catch (err) {
    console.log("POST /users/:userID/guildMemberships error updating user guild memberships: ", err);
    res.status(500).json({ error: "failed to update user guild memberships" });
    return;
  }
})

export default router;
