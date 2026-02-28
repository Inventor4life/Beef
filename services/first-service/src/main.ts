import express from "express";
import type {Request, Response, NextFunction} from "express";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import path from "path";
import { requireAuth } from "./middleware.js";
import { connectToDb, closeDb } from "./db.js";
import https from "https";
import fs from "fs";

dotenv.config();

const key = fs.readFileSync("./certs/authkey.pem");
const cert = fs.readFileSync("./certs/authcert.pem");

const app = express();
app.use(express.json())
app.use(cookieParser());
app.use(express.urlencoded({ extended: true })); // parse URL-encoded bodies for google

// Google JWT verification
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const authClient = new OAuth2Client({clientId: CLIENT_ID})
async function verifyJWT(token: string) {
  const ticket = await authClient.verifyIdToken({idToken: token, audience:CLIENT_ID});
  return ticket.getPayload();
}

// Internal JWT creation
const secretKey: string = process.env.JWT_SECRET!; // sha256 of SuperSecretAuthKey
const options: SignOptions = {
  issuer: "myAuthService",
  audience: "beef",
  algorithm: 'HS256',
  expiresIn: Number(process.env.JWT_EXPIRY) // in seconds.
}

process.title = ""; // Set no name, server-start.sh sets one for us.

let HOST: string;
let PORT: number;
if(process.env.PRODUCTION === undefined) {
	console.log("Not in production");
	HOST = "127.0.0.1";
	PORT = 3000;
} else {
	console.log("In production");
	HOST = "10.0.0.6";
	PORT = 3000;
};

app.get('/', (req: Request, res: Response) => {
    res.send("Typescript with express!");
});

app.get('/test-auth', requireAuth, (req: Request, res: Response) => {
	res.json({ user: res.locals.user });
});

app.get('/auth', (req: Request, res: Response) => {
	res.sendFile("./data/index.html", {root: path.resolve(import.meta.dirname, "../")});
});

app.post('/auth', async (req: Request, res: Response) => {
  console.log("received POST, running tests..."); // body g_csrf_token: ${req.body.g_csrf_token}, header cookie g_csrf_token: ${req.cookies.g_csrf_token}\n credential: ${req.body.credential}`);
  if(req.cookies.g_csrf_token == undefined || req.cookies.g_csrf_token != req.body.g_csrf_token) {
    console.log("csrf test failed");
    res.redirect("/");
    return;
  } // else

  console.log("csrf test passed");
  const googlePayload = await verifyJWT(req.body.credential)
  if(googlePayload == undefined) { // verifyJWT returns undefined if the JWT could not be authenticated.
    console.log("JWT verification failed");
    res.redirect("/");
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
    maxAge: (Number(process.env.JWT_EXPIRY) * 1000), // s to ms
    httpOnly: true,
    secure: true,
    sameSite: "strict"
  })

  // Redirect them to / for cookie processing
  // no longer redirecting to /index since this is a monolithic server, no reason to
  res.redirect("/");
});

const server = await connectToDb().then(() => {
	return https.createServer({key, cert}, app).listen(PORT, HOST, () => {
		console.log(`Server running at https://${HOST}:${PORT}/`);
	});
});

process.on('SIGTERM', async () => {
	server.close();
	await closeDb();
})
