import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from './middleware.js';
import { getCollection, isDbConnected } from './db.js';

interface Guild {
    _id: string;
    friendlyName: string;
    members: string[];
    channels: [{ friendlyName: string; _id: string }];
}

const router = Router();

// :guildID is the route parameter, otherwise we would do /guilds?guildID=123
// 401 code is handled by requireAuth
router.get('/guilds/:guildID', requireAuth, async (req: Request, res: Response) => {
    if (!isDbConnected()) {
        // NOTE: Issue says 503 if query failed due to timed out, db offline, etc.
        // but sprint2plan says 503 if can't connect to db, 500 otherwise
        // ill follow sprint2plan but lmk if it should be changed
        res.status(503).json({ error: "database not connected" });
        return;
    }
    const guildID = req.params.guildID;
    // confirm it is string for mongodb, have to do or else ts error
    if (!guildID || typeof guildID !== 'string') {
        // added 400 code, better suited for this error (bad request)
        res.status(400).json({ error: "guildID is required and must be a string" });
        return;
    }
    try {
        // mongodb expects _id to be objectID generically
        // however in db it is actually string
        // so we have to define interface to avoid typescript error
        const guild = await getCollection<Guild>("guilds").findOne({ _id: guildID });
        if (!guild) {
            res.status(404).json({ error: "guild not found" });
            return;
        }
        res.status(200).json(guild);
    } catch (err) {
        console.log("Error fetching guild:", err);
        res.status(500).json({ error: "failed to fetch guild" });
    }
});

export default router;
