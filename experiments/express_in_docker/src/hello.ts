const express = require("express")
import type {Request, Response, NextFunction} from "express"

const app = express();
app.use(express.json())

const PORT = 3000

app.get('/', (req: Request, res: Response) => {
    res.send("Typescript with express!");
})

app.get('/test/:str', (req: Request, res: Response) => {
    console.log(`received wildcard ${req.params.str}`)
    res.send(`Received wildcard ${req.params.str}`)
})

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
})
