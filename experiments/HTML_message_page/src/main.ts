import express = require('express');
import path = require('path')
import type { Request, Response, NextFunction } from 'express';

const THIS_FILE_DIR = import.meta.dirname

interface Message {
  author?: String,
  id?: number,
  content: String
}

let myMessages: Message[] = [];
let nextMessageID=0;

const app = express();
const PORT = 3000;

app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
  next();
})

app.get('/', (req: Request, res: Response) => {
  res.sendFile("./index.html", {root: path.resolve(THIS_FILE_DIR,"../src")});
});

app.get('/msg', (req: Request, res: Response) => {
  res.sendFile("./messages.html", {root: path.resolve(THIS_FILE_DIR,"../src")});
});


app.post('/messages', (req: Request, res: Response) => {
  console.log(req.body)
  // Assumes req.body is of type Message
  let newMessage = {
    author: "Anonymous",
    id: nextMessageID,
    content: req.body.content
  }
  myMessages.push(newMessage)
  res.status(200).json(newMessage);
  nextMessageID++;
});

app.get('/messages', (req: Request, res: Response) => {
  res.status(200).json(myMessages);
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
