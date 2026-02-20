import express from 'express';
import cookieParser from 'cookie-parser';
import type { Request, Response, NextFunction } from 'express';
import type { SignOptions } from 'jsonwebtoken';
import https from 'https';
import path from 'path';
import fs from 'fs';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';

// express app settings
const app = express();
const PORT = 3001;
const __dirname = import.meta.dirname;

// Load credentials, create server
const key = fs.readFileSync("./certs/authkey.pem")
const cert = fs.readFileSync("./certs/authcert.pem")
const server = https.createServer({key:key, cert:cert}, app);

// Google JWT verification
const CLIENT_ID = "234677186525-7pptsu7ec995iiukijg38pqp00rg08u1.apps.googleusercontent.com"
const authClient = new OAuth2Client({clientId: CLIENT_ID})
async function verifyJWT(token: string) {
  const ticket = await authClient.verifyIdToken({idToken: token, audience:CLIENT_ID});
  return ticket.getPayload();
}

// Internal JWT creation
const secretKey: string = "d79f03badeab4a07e1206c1bf3c48cd0b175b3f16bd138b69990ad1b34d28e36" // sha256 of SuperSecretAuthKey
const options: SignOptions = {
  issuer: "myAuthService",
  audience: "beef",
  algorithm: 'HS256',
  expiresIn: 60 // 1 minutes, in seconds.
}

// middleware to parse json bodies
app.use(express.json())

// middleware to parse header cookies
app.use(cookieParser());

// middleware to parse url-encoded bodies
app.use(express.urlencoded({ extended: true }));

/*/
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(req);
  next();
})
//*/

app.get('/auth', (req: Request, res: Response) => {
  res.send("Welcome to Auth! Glad you made it.")
  //res.sendFile("./data/index.html", {root: path.resolve(__dirname, "../")});
});

app.post('/auth', async (req: Request, res: Response) => {
  console.log("received POST, running tests..."); // body g_csrf_token: ${req.body.g_csrf_token}, header cookie g_csrf_token: ${req.cookies.g_csrf_token}\n credential: ${req.body.credential}`);
  if(req.cookies.g_csrf_token == undefined || req.cookies.g_csrf_token != req.body.g_csrf_token) {
    console.log("csrf test failed");
    res.redirect("/index");
    return;
  } // else

  console.log("csrf test passed");
  const googlePayload = await verifyJWT(req.body.credential)
  if(googlePayload == undefined) { // verifyJWT returns undefined if the JWT could not be authenticated.
    console.log("JWT verification failed");
    res.redirect("/index");
    return;
  } // else

  // JWT validation successful, print as such
  console.log(`JWT verification: ${googlePayload.sub}`);
  console.log(`JWT name: ${googlePayload?.given_name}`);

  // Sign internal JWT
  const internalPayload = {
    // Registered Claims
    "sub": "beefid:"+googlePayload.sub,
    
    // Private claims
    "name": googlePayload?.name ?? "Anonymous"
  };
  const token = jwt.sign(internalPayload, secretKey, options);

  // Give signed JWT to user
  res.cookie("user_token", token, {
    maxAge: 60000, // 1 minute, in milliseconds
    httpOnly: true,
    secure: true,
    sameSite: "strict"
  })

  // Redirect them to /index for cookie processing
  res.redirect("/index");
});


// Start server
server.listen(PORT, () => {
  console.log(`Auth server is running on https://localhost:${PORT}`);
});
