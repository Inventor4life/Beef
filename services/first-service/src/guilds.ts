import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from './middleware.js';
import { getCollection, isDbConnected } from './db.js';
import { generateSnowflake } from './snowflake.js';

interface Guild {
    _id: string;
    friendlyName: string;
    members: string[];
    channels: [{ friendlyName: string; _id: string }];
}

interface Message {
    _id: string;
    channelID: string;
    authorID: string;
    content: string;
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
        res.status(500).json({ error: "guildID is required and must be a string" });
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

router.post('/guilds/:guildID/channels/:channelID/messages', requireAuth, async (req: Request, res: Response) => {
    // check if db not connected
    if (!isDbConnected()) {
        res.status(503).json({ error: "database not connected" });
        return;
    }

    const guildID = req.params.guildID;
    const channelID = req.params.channelID;
    
    // validate guildID is string
    if (!guildID || typeof guildID !== 'string') {
        res.status(500).json({ error: "guildID is required and must be a string" });
        return;
    }

    // same for channelID
    if (!channelID || typeof channelID !== 'string') {
        res.status(500).json({ error: "channelID is required and must be a string" });
        return;
    }

    try {
        // find guild
        const guild = await getCollection<Guild>("guilds").findOne({ _id: guildID });
        // 404 if no guild
        if (!guild) {
            res.status(404).json({ error: "guild not found" });
            return;
        }
        // find channel in guild
        const channel = guild.channels.find(c => c._id === channelID);
        // 404 if no channel
        if (!channel) {
            res.status(404).json({ error: "channel not found" });
            return;
        }

        // validate req body
        const { content } = req.body;
        if (!content || typeof content !== 'string') {
            res.status(500).json({ error: "content is required and must be a string" });
            return;
        }

        const user = res.locals.user;

        const message: Message = {
            _id: generateSnowflake(),
            channelID: channelID,
            authorID: user.sub, // instead of name in messages.ts post route since we want UUID
            content: content
        }
        // insert into db
        try {
            await getCollection<Message>("messages").insertOne(message);
        }
        catch (err) {
            res.status(503).json({ error: "failed to insert message into database" });
            return;
        }
        res.status(201).json(message);

    } catch (err) {
        console.log("Error creating message:", err);
        res.status(500).json({ error: "failed to create message" });
    }

});

router.get('/guilds/:guildID/channels/:channelID/messages', requireAuth, async (req: Request, res: Response) => {
    if (!isDbConnected()) {
        res.status(503).json({ error: "database not connected" });
        return;
    }

    const guildID = req.params.guildID;
    const channelID = req.params.channelID;

    // validate guildID is string
    if (!guildID || typeof guildID !== 'string') {
        res.status(500).json({ error: "guildID is required and must be a string" });
        return;
    }

    // same for channelID
    if (!channelID || typeof channelID !== 'string') {
        res.status(500).json({ error: "channelID is required and must be a string" });
        return;
    }

    try {
        // find guild
        const guild = await getCollection<Guild>("guilds").findOne({ _id: guildID });
        // 404 if no guild
        if (!guild) {
            res.status(404).json({ error: "guild not found" });
            return;
        }
        // find channel in guild
        const channel = guild.channels.find(c => c._id === channelID);
        // 404 if no channel
        if (!channel) {
            res.status(404).json({ error: "channel not found" });
            return;
        }

        const beforeID = req.query.beforeID;
        // filter is an object which has channelID, and an optional _id which uses $lt (mongodb less than operator) to filter messages before some time
        // essentially passing this object filters to only messages in the channel, and only messages before the beforeID (if provided)
        let filter: { channelID: string; _id?: { $lt: string } } = { channelID: channelID };
        // if we have beforeID pad it and include it in the filter
        if (beforeID && typeof beforeID === 'string') {
            filter._id = { $lt: beforeID.padStart(20, '0') }; // https://www.mongodb.com/docs/manual/reference/operator/query/lt/
        }

        // find messages in db with filter, limit 50, most to least recent
        const messages = await getCollection<Message>("messages").find(filter).sort({ _id: -1 }).limit(50).toArray();
        res.status(200).json(messages);
    } catch (err) {
        console.log("Error fetching messages:", err);
        res.status(500).json({ error: "failed to fetch messages" });
    }
});

export default router;
