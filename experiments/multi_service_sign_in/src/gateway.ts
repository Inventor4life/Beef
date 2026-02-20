import express from 'express'
import type {Request, Response, NextFunction} from 'express'
import https from 'https'
import fs from 'fs'
import proxy from "express-http-proxy"

const key = fs.readFileSync("./certs/gatekey.pem")
const cert = fs.readFileSync("./certs/gatecert.pem")

const _authCert = fs.readFileSync("./certs/authcert.pem")
const authAgent = new https.Agent({
ca: _authCert
});

const _presCert = fs.readFileSync("./certs/prescert.pem");
const presAgent = new https.Agent({
  ca: _presCert
})

const app = express();
const PORT = 3000;

const server = https.createServer({key:key, cert:cert}, app);

app.use("/auth", proxy("https://localhost:3001", {
  proxyReqPathResolver: function (req) {
    return req.originalUrl;
  },
  proxyReqOptDecorator: function(proxyReqOpts, srcReq) {
    proxyReqOpts.agent = authAgent
    return proxyReqOpts;
  }
}))

app.use("/index", proxy("https://localhost:3002", {
  proxyReqPathResolver: function (req) {
    return req.originalUrl;
  },
  proxyReqOptDecorator: function(proxyReqOpts, srcReq) {
    proxyReqOpts.agent = presAgent
    return proxyReqOpts;
  }
}))

app.get('/', (req: Request, res: Response) => {
  res.send("Hello! you have reached the Gateway!")
})

server.listen(PORT, () => {
  console.log(`Gateway is running on https://localhost:${PORT}`);
})
