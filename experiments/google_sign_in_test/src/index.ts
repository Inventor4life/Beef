import express from 'express';
import cookieParser from 'cookie-parser';
import type { Request, Response, NextFunction } from 'express';
import https from 'https';
import path from 'path';
import fs from 'fs';
import { OAuth2Client } from 'google-auth-library';

const app = express();
const PORT = 3000;
const __dirname = import.meta.dirname;

// Load credentials
const key = fs.readFileSync("./certs/key.pem")
const cert = fs.readFileSync("./certs/cert.pem")

const server = https.createServer({key:key, cert:cert}, app);

const CLIENT_ID = "234677186525-7pptsu7ec995iiukijg38pqp00rg08u1.apps.googleusercontent.com"
const authClient = new OAuth2Client({clientId: CLIENT_ID})
async function verifyJWT(token: string) {
  const ticket = await authClient.verifyIdToken({idToken: token, audience:CLIENT_ID});
  return await ticket.getPayload();
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
  res.sendFile("./data/index.html", {root: path.resolve(__dirname, "../")});
});

app.post('/auth', (req: Request, res: Response) => {
  console.log("received POST, running tests..."); // body g_csrf_token: ${req.body.g_csrf_token}, header cookie g_csrf_token: ${req.cookies.g_csrf_token}\n credential: ${req.body.credential}`);
  if(req.cookies.g_csrf_token != undefined && req.cookies.g_csrf_token == req.body.g_csrf_token) {
    console.log("csrf test passed");
    verifyJWT(req.body.credential).then((value)=>{
      console.log(`JWT verification: ${value?.sub}`);
      console.log(`JWT name: ${value?.given_name}`);
    })
    
  } else {
    console.log("csrf test failed");
  }
  
  res.sendFile("./data/index.html", {root: path.resolve(__dirname, "../")});
});

// Start server
server.listen(PORT, () => {
  console.log(`Server is running on https://localhost:${PORT}`);
});
