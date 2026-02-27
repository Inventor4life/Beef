import express, { response } from "express";
import type {Request, Response, NextFunction} from "express";

const app = express();
app.use(express.json())

process.title = ""; // Set no name, server-start.sh sets one for us.

let HOST: string;
let PORT: number;
switch(process.env.APP_ENV) {
	case "PRODUCTION":
		console.log("Started as Production");
		HOST = "10.0.0.6";
		PORT = 3000;
	break;
	case "DEVELOPMENT":	
		console.log("Started as Development");
		HOST = "127.0.0.1";
		PORT = 3000;
	break;
	default:
		console.log(`Unknown environment ${process.env.APP_ENV}`);
		process.exit(1)
};

app.get('/', (req: Request, res: Response) => {
    res.send("Typescript with express!");
});

app.get('/auth', (req: Request, res: Response) => {
	res.send("Welcome to the Auth endpoint");
})

const server = app.listen(PORT, HOST, () => {
    console.log(`Server is running on ${HOST}:${PORT}`);
});

process.on('SIGTERM', () => {
	server.close();
})
