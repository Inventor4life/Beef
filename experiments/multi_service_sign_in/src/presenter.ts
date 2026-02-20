import express from 'express'
import type {Request, Response, NextFunction} from 'express'
import cookieParser from 'cookie-parser'
import jwt, { type JwtPayload, type VerifyOptions } from 'jsonwebtoken'
import https from 'https'
import path from 'path'
import fs from 'fs'

const __dirname = import.meta.dirname;

const key = fs.readFileSync("./certs/preskey.pem");
const cert = fs.readFileSync("./certs/prescert.pem");

const successPageTemplate = fs.readFileSync("./data/successful-auth.html").toString();

const _authJwtSecret: string = "d79f03badeab4a07e1206c1bf3c48cd0b175b3f16bd138b69990ad1b34d28e36" // sha256 of SuperSecretAuthKey
const options: VerifyOptions = {
  issuer: "myAuthService",
  audience: "beef",
  algorithms: ['HS256']
}

const app = express();
const PORT = 3002

app.use(express.json()); // Parse body as json
app.use(cookieParser()); // Parse header cookies

app.get("/index", (req: Request, res: Response) => {
  const token: string = req.cookies.user_token ?? "";
  if(token == "") {
    // No token provided
    console.log("No token. Being sent to homepage");
    res.sendFile("./data/index.html", {root: path.resolve(__dirname, "../")});
    return;
  } // else
  // Token present, may be invalid
  try {
    // Validate token
    const decoded = jwt.verify(token, _authJwtSecret, options);
    const successPage = successPageTemplate.replaceAll(/[{]{2}\s*CLIENT_NAME\s*[}]{2}/g, (decoded as JwtPayload).name); // Generate success page
    res.send(successPage);
    console.log(`Successful sign in by ${(decoded as JwtPayload).name}`);
  } catch (err) {
    console.log(`Bad Token Check: error ${err}`);
    res.sendFile("./data/index.html", {root: path.resolve(__dirname, "../")});
    return;
  }
})

const server = https.createServer({key:key, cert:cert}, app)
server.listen(PORT, () => {
  console.log(`Presenter service listening at https://localhost:${PORT}`);
});
