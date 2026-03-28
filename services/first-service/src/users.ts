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
