import express from "express";
import { Agent } from "undici"
import https from "https"
import type {Request, Response, NextFunction} from "express";
import dotenv from "dotenv";
import path from "path";
import { connectToDb, closeDb, isDbConnected } from "./db.js";
import fs from "fs";
import messageRoutes, { initMessages } from "./messages.js";
import guildRoutes from "./guilds.js";
import inviteRoutes from "./invites.js";
import userRoutes from "./users.js"
import { authRoutes, authUseAgent, setLocalUrlPrefix } from "./auth.js";

// I would rather the process title be set in the startup script, but we haven't gotten that working reliably.
// My gut says this service should have little to no concept of what the process title is, because it doesn't yet need
//  to know or change it outside of this bug fix. Because the process name is needed by the status and stop scripts,
//  ideally it should be created by the startup script so we can package/reuse the scripts for other services.
// Currently we have to rely on setting the process title here and hoping that it matches the status and stop scripts.
process.title = "first-service"
dotenv.config();

const app = express();
app.use(express.json())

app.use(messageRoutes); // use the message routes defined in messages.ts
app.use(guildRoutes); // use the guild routes defined in guilds.ts
app.use(inviteRoutes); // use the invite routes defined in invites.ts
app.use(userRoutes); // use the user routes defined in users.ts
app.use(authRoutes); // use the auth routes defined in auth.ts

// Google OAuth client ID
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;

// Generic runtime parameters
const PATH_THIS_FILE = import.meta.dirname;

let HOST: string;
let PORT: number;
let key;
let cert;
switch(process.env.APP_ENV) {
	case "PRODUCTION":
		console.log("Started as Production");
		HOST = "10.0.0.6";
		PORT = 3000;
    key = fs.readFileSync("/prod/certs/first-service.key");
    cert = fs.readFileSync("/prod/certs/first-service.crt");
		setLocalUrlPrefix("https://10.0.0.6:3000")
	break;
	case "DEVELOPMENT":	
		console.log("Started as Development");
		HOST = "127.0.0.1";
		PORT = 3000;
    key = fs.readFileSync(path.resolve(PATH_THIS_FILE, "../../../tools/dev-certs/devcert1.key")); // /services/first-service/src/main.ts -> /tools/dev-certs/devcert1.key
    cert = fs.readFileSync(path.resolve(PATH_THIS_FILE, "../../../tools/dev-certs/devcert1.crt"));
		setLocalUrlPrefix("https://localhost:3000")
	break;
	default:
		console.log(`Unknown environment ${process.env.APP_ENV}`);
		process.exit(1)
};

const serviceAgent = new Agent({ // Https agent so that this service can call its own endpoints.
  connect: {
    ca: cert,
		rejectUnauthorized: false
  }
})
authUseAgent(serviceAgent);

const LOGIN_URI = process.env.LOGIN_URI!;
const indexPageTemplate = fs.readFileSync(path.resolve(PATH_THIS_FILE,"../data/index.html"), {encoding: "utf-8"});
const indexPage = indexPageTemplate.replaceAll(/[{]{2}\s*CLIENT_ID\s*[}]{2}/g, CLIENT_ID)
                                   .replaceAll(/[{]{2}\s*LOGIN_URI\s*[}]{2}/g, LOGIN_URI);

app.get('/', (req: Request, res: Response) => {
	res.send(indexPage);
});

// simple health checkpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: "ok" ,
    db: isDbConnected() ? "connected" : "not connected"
  });
});

// now separating the server startup and DB connection so that the server can start even if the DB is not available
const server = https.createServer({key, cert}, app).listen(PORT, HOST, () => {
  console.log(`Server running at https://${HOST}:${PORT}/`);
});

connectToDb().then(() => initMessages()).then(() => console.log("DB connected.")).catch((err) => console.error("Failed to connect to DB:", err));

process.on('SIGTERM', async () => {
	server.close();
	await closeDb();
})
