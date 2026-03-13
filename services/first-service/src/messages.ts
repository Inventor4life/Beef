import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from './middleware.js';
import { getCollection, isDbConnected } from './db.js';

// using router since we are not in main.ts, then export the router to be used in main.ts
const router = Router();
let lastMsgId: number = 0;

// init msg counter
export async function initMessages() {
    const collection = getCollection("messages");
    const lastMessage = await collection.findOne({}, { sort: { id: -1 } });
    if (lastMessage) {
        lastMsgId = lastMessage.id;
    }
    console.log(`Last message id: ${lastMsgId}`);
}

function getNextMessageId() {
    lastMsgId++;
    return lastMsgId;
}

// basic get, nothing complicated
router.get('/messages', requireAuth, async (req: Request, res: Response) => {
    // added check for db connection since now db doesn't have to be connected for the service to start
    if (!isDbConnected()) {
        res.status(503).json({ error: "database not connected" });
        return;
    }
    try {
        const messages = await getCollection("messages").find().toArray();
        res.status(200).json(messages);
    } catch (err) {
        console.log("Error fetching messages:", err);
        res.status(500).json({ error: "failed to fetch messages" });
    }
});

// same for post, simple logic since middleware already defined
router.post('/messages', requireAuth, async (req: Request, res: Response) => {
    if (!isDbConnected()) {
        res.status(503).json({ error: "database not connected" });
        return;
    }

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
        await getCollection("messages").insertOne(message);
        res.status(201).json(message);
    } catch (err) {
        console.log("Error creating message:", err);
        res.status(500).json({ error: "failed to create message" });
    }
});

export default router;
