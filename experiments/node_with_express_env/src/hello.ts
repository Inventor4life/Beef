import express = require('express');
import path = require('path')
import type { Request, Response, NextFunction } from 'express';
import dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(req);
  next();
})

app.get('/', (req: Request, res: Response) => {
  res.sendFile("./src/index.html", {root: path.resolve(__dirname, "../")});
});

app.get('/env/', (req: Request, res: Response ) =>{
  res.json({test: `${process.env.TEST_ENV}`})
})

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});



// Start server
app.listen(PORT, '192.168.100.1', () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
