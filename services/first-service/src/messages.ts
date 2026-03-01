import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from './middleware.js';
import { getMessagesCollection, getNextMessageId } from './db.js';
import { get } from 'node:http';

// using router since we are not in main.ts, then export the router to be used in main.ts
const router = Router();

// basic get, nothing complicated
router.get('/messages', requireAuth, async (req: Request, res: Response) => {
    try {
        const messages = await getMessagesCollection().find({}).toArray();
        res.status(200).json(messages);
    } catch (err) {
        console.log("Error fetching messages:", err);
        res.status(500).json({ error: "failed to fetch messages" });
    }
});

// same for post, simple logic since middleware already defined
router.post('/messages', requireAuth, async (req: Request, res: Response) => {
    const { content} = req.body;
    if (!content || typeof content !== 'string') {
        res.status(400).json({ error: "content is required and must be a string" });
        return;
    }
    const user = res.locals.user;
    const message = {
        id: getNextMessageId(),
        author: user.name,
        content: content
    };
    try {
        await getMessagesCollection().insertOne(message);
        res.status(201).json(message);
    } catch (err) {
        console.log("Error creating message:", err);
        res.status(500).json({ error: "failed to create message" });
    }
});

export default router;
