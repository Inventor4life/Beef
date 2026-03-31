import express, { Router } from 'express';
import type { Request, Response } from 'express';
import { Agent } from 'undici'
import { OAuth2Client } from "google-auth-library";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import cookieParser from "cookie-parser";

//local imports
import type { User } from './users.js'
import { requireAuth } from './middleware.js'
// import usersApiWrapper...

export const authRoutes = Router();

dotenv.config();

// Google JWT verification
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const authClient = new OAuth2Client({clientId: CLIENT_ID})
async function verifyJWT(token: string) {
  try {
    const ticket = await authClient.verifyIdToken({idToken: token, audience:CLIENT_ID});
    return ticket.getPayload();
  } catch (err) {
    console.log("Failed to verify Google's JWT: ", err)
    return undefined
  }
}

// Internal JWT creation options
const secretKey: string = process.env.JWT_SECRET!; // sha256 of SuperSecretAuthKey
const options: SignOptions = {
  issuer: "myAuthService",
  audience: "beef",
  algorithm: 'HS256',
  expiresIn: Number(process.env.JWT_EXPIRY) // in seconds.
}

interface ApiError {
  status: number,
  response: object
}

function generateServiceToken() : string{
  return jwt.sign({"sub":""}, secretKey, options)
}

let thisServiceToken = generateServiceToken();
// Helper functions. Will eventually be replaced by an API wrapper library
//

// Convert local url to absolute. May be modified to perform DNS lookup for multiple services?
const getLocalUrl = (path: string) => `https://localhost:3000${path}`;

let serviceAgent: Agent | null = null;
export function authUseAgent(newAgent: Agent) {
  serviceAgent = newAgent;
}

async function userGetFromOidc(serviceToken: string, oidcSub: string) : Promise<User | ApiError>{
  const res = await fetch(getLocalUrl(`/users?oidcSub=${oidcSub}`),
    {
      headers: {
        user_token: serviceToken,
        cookie: `user_token=${serviceToken};`
      },
      dispatcher: serviceAgent
    } as RequestInit
  )
  if(res.status != 200) {
    return {
      status: res.status,
      response: res
    }
  } // else
  const aUser = await res.json()
  return aUser as User // This should always be a User structure if the users endpoint is functioning correctly
}

async function userCreate(serviceToken: string, newUser: {friendlyName: string, oidcSub: string}) : Promise<User | ApiError> {
  const res = await fetch(getLocalUrl('/users'), {
    method: "POST",
    body: JSON.stringify(newUser),
    headers: {
      "Content-type": "application/json; charset=UTF-8",
      cookie: `user_token=${serviceToken};`
    },
    dispatcher: serviceAgent
    } as any
  )
  if(res.status != 201) {
    return {
      status: res.status,
      response: res
    }
  } // else
  const aUser = await res.json();
  return aUser as User
}

//
// End helper functions

authRoutes.use(cookieParser());
authRoutes.use(express.json());
authRoutes.use(express.urlencoded({ extended: true })); // parse URL-encoded bodies for google

authRoutes.post('/auth', async (req: Request, res: Response) => {
  console.log("received POST, running tests..."); // body g_csrf_token: ${req.body.g_csrf_token}, header cookie g_csrf_token: ${req.cookies.g_csrf_token}\n credential: ${req.body.credential}`);
  if(!req.cookies.g_csrf_token || req.cookies.g_csrf_token !== req.body.g_csrf_token) {
    console.log("csrf test failed");
    res.json({error: "csrf test failed"}).redirect(401,"/");
    return;
  } // else

  console.log("csrf test passed");
  const googlePayload = await verifyJWT(req.body.credential)
  if(!googlePayload) { // verifyJWT returns undefined if the JWT could not be authenticated.
    console.log("OAuth signature failed");
    res.json({error: "OAuth signature failed"}).redirect(401,"/");
    return;
  } // else

  // Query user service for log in details
  let reattempt = 2; 
  // Used for retrying the request if the service token was expired.
  // 2 was chosen for the following edge case:
  // reattempt --; (reattempt is 1)
  // GET user
  //  -> 401 invalid token
  // (regenerate token)
  // reattempt --; (reattempt is 0)
  // GET user
  //  -> Some other status

  while(reattempt) {
    reattempt--;
    let result = await userGetFromOidc(thisServiceToken, googlePayload.sub);
    if('status' in result) { // True only on API error
      switch (result.status) {
        case 401:
          thisServiceToken = generateServiceToken();
          // Will reattempt request
          if(reattempt == 0) {
            res.status(500).json({error: "Internal server error"})
            return;
          }
          continue; // Breaks switch and restarts loop
        case 503:
          res.status(503).json({error: "query failed"});
          console.log("POST /auth database query failed");
          return;
        case 404:
          // User does not exist. Need to create user.
          result = await userCreate(thisServiceToken, { // If this fails, result is quickly overwritten on next attempt
            friendlyName: googlePayload.given_name || "Anonymous",
            oidcSub: googlePayload.sub
          })
          if('status' in result) {
            console.log("POST /auth create user failed: ", result.status);
            if(result.status != 401) {
              res.status(500).json({error: "Internal server error"})
              return;
            }
            continue; // Reattempt
          }
          // else, result is the newly created User
          break;
        default:
          res.status(500).json({error: "Internal server error"})
          console.log("POST /auth unknown error, status ", result.status)
          return;
      }
    } // else (except for successful user creation)
    //
    // User found. Issue token
    //

    // Sign user token
    const internalPayload = {
      // Registered Claims
      "sub": result._id, 
    };

    const token = jwt.sign(internalPayload, secretKey, options)
    res.cookie("user_token", token, {
      maxAge: (Number(process.env.JWT_EXPIRY) * 1000), // s to ms
      httpOnly: true,
      secure: true,
      sameSite: "strict"
    }).redirect("/chat")//("/auth#/messages")

    return;
  }
  res.status(500).json({error: "Internal server error"}) // This might be reached if POSTing a user fails twice in a row.
});

authRoutes.get('/test-auth', requireAuth, (req: Request, res: Response) => {
	res.json({ user: res.locals.user });
});
