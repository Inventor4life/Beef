import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from './middleware.js';
import { getCollection, isDbConnected } from './db.js';
import { generateSnowflake } from './snowflake.js';

interface User {
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
router.post('/users', requireAuth, async (req: Request, res: Response)=>{
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
    console.log("Error inserting user:", err)
    res.status(500).json({ error: "failed to insert new user into database" });
    return;
  }

  res.status(201).json(newUser);

  // Not really a place to catch a generic error and return code 500.
})

router.get('/users/me', requireAuth, async (req: Request, res: Response) => {
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
    console.log("Missing userID for /users/me. (id, type): ", userID, typeof userID);
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

router.get('/users/:userID/short', requireAuth, async (req: Request, res: Response) => {
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

router.get('/users/:userID', requireAuth, async (req: Request, res: Response) => {
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
    console.log(err);
    res.status(500).json({ error: "failed to fetch user"})
  }

});

export default router;
