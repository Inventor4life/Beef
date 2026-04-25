import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireScope } from './middleware.js';
import { getCollection, isDbConnected } from './db.js';
import { generateSnowflake } from './snowflake.js';

interface Invite {
    _id: string;
    guildID: string;
}

const router = Router();

router.post('/invites', requireAuth, requireScope("service"), async (req: Request, res: Response) => {
    if (!isDbConnected()) {
        res.status(503).json({ error: "database not connected" });
        return;
    }

    const { guildID } = req.body;
    if (!guildID || typeof guildID !== 'string') {
        res.status(400).json({ error: "guildID is required and must be a string" });
        return;
    }

    const invite: Invite = {
        _id: generateSnowflake(),
        guildID: guildID
    };

    try {
        const insertResult = await getCollection<Invite>("invites").insertOne(invite);
        if (!insertResult.acknowledged) {
            res.status(503).json({ error: "failed to insert invite into database" });
            return;
        }
    } catch (err) {
        console.log("POST /invites error inserting invite:", err);
        res.status(503).json({ error: "failed to insert invite into database" });
        return;
    }

    res.status(201).json({
        inviteCode: invite._id,
        guildID: invite.guildID
    });
});

export default router;
