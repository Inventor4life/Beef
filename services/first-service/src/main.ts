import express, { response } from "express";
import type {Request, Response, NextFunction} from "express";

const app = express();
app.use(express.json())

process.title = "first-service"; // Set name for easy process killing

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

app.get('/auth', (req: Request, res: Response) => {
	res.send("Welcome to the Auth endpoint");
})

const server = app.listen(PORT, HOST, () => {
    console.log(`Server is running on ${HOST}:${PORT}`);
});

process.on('SIGTERM', () => {
	server.close();
})
