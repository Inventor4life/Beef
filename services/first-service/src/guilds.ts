import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireScope } from './middleware.js';
import { getCollection, isDbConnected } from './db.js';
import { generateSnowflake } from './snowflake.js';
import { generateServiceToken, getLocalUrl, getServiceAgent } from './auth.js';
import jwt from "jsonwebtoken"
import type { SignOptions } from 'jsonwebtoken';

const MAX_GUILD_NAME_LENGTH = 32;
const MAX_CHANNEL_NAME_LENGTH = 32;
const MAX_TEXT_CHANNELS = 16;
const MAX_VOICE_CHANNELS = 2;

type ChannelType = "Voice" | "Text";

interface Guild {
    _id: string;
    friendlyName: string;
    owner: string;
    members: string[];
    channels: Channel[];
    invites: string[];
}

interface Channel {
    _id: string;
    friendlyName: string;
    type: ChannelType;
}

interface Message {
    _id: string;
    channelID: string;
    authorID: string;
    content: string;
}

type ServiceCallResult =
    | { ok: true }
    | { ok: false; status: number; message: string };

type InviteCallResult =
    | { ok: true; inviteCode: string }
    | { ok: false; status: number; message: string };


// Voice JWT creation options
const secretKey: string = process.env.JWT_SECRET!; // sha256 of SuperSecretAuthKey
const options: SignOptions = {
  issuer: "myAuthService",
  audience: "beef-voice",
  algorithm: 'HS256',
  expiresIn: Number(process.env.JWT_EXPIRY) // in seconds.
}

const router = Router();
let serviceToken = generateServiceToken();

function isValidGuildName(friendlyName: unknown): friendlyName is string {
    if (typeof friendlyName !== 'string') {
        return false;
    }

    const isPrintableAscii = /^[\x20-\x7E]+$/.test(friendlyName);
    const startsWithWhitespace = /^\s/.test(friendlyName);

    return (
        friendlyName.length > 0 &&
        friendlyName.length <= MAX_GUILD_NAME_LENGTH &&
        isPrintableAscii &&
        !startsWithWhitespace
    );
}

function isValidChannelName(friendlyName: unknown): friendlyName is string {
    if (typeof friendlyName !== 'string') {
        return false;
    }

    const hasControlCharacter = /[\x00-\x1F\x7F]/.test(friendlyName);
    const startsWithWhitespace = /^\s/.test(friendlyName);

    return (
        friendlyName.length > 0 &&
        friendlyName.length <= MAX_CHANNEL_NAME_LENGTH &&
        !hasControlCharacter &&
        !startsWithWhitespace
    );
}

function isValidChannelType(type: unknown): type is ChannelType {
    return type === "Voice" || type === "Text";
}

function getChannelLimit(type: ChannelType): number {
    if (type === "Text") {
        return MAX_TEXT_CHANNELS;
    }

    return MAX_VOICE_CHANNELS;
}

function makeServicePostRequest(body: object): RequestInit {
    return {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
            "Content-Type": "application/json; charset=UTF-8",
            cookie: `user_token=${serviceToken};`
        },
        dispatcher: getServiceAgent() ?? undefined
    } as RequestInit;
}

async function readResponseMessage(response: globalThis.Response): Promise<string> {
    try {
        const bodyText = await response.text();
        return bodyText || response.statusText;
    } catch {
        return response.statusText;
    }
}

async function addUserGuildMembership(userID: string, guildID: string): Promise<ServiceCallResult> {
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const response = await fetch(
                getLocalUrl(`/users/${encodeURIComponent(userID)}/guildMemberships`),
                makeServicePostRequest({ guildID: guildID })
            );

            if (response.status === 401 && attempt === 0) {
                serviceToken = generateServiceToken();
                continue;
            }

            if (response.status === 201 || response.status === 200) {
                return { ok: true };
            }

            return {
                ok: false,
                status: response.status,
                message: await readResponseMessage(response)
            };
        } catch (err) {
            return {
                ok: false,
                status: 500,
                message: String(err)
            };
        }
    }

    return {
        ok: false,
        status: 500,
        message: "service token refresh failed"
    };
}

async function createGuildInvite(guildID: string): Promise<InviteCallResult> {
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const response = await fetch(
                getLocalUrl('/invites'),
                makeServicePostRequest({ guildID: guildID })
            );

            if (response.status === 401 && attempt === 0) {
                serviceToken = generateServiceToken();
                continue;
            }

            if (response.status !== 201) {
                return {
                    ok: false,
                    status: response.status,
                    message: await readResponseMessage(response)
                };
            }

            const responseBody = await response.json();
            if (!responseBody.inviteCode || typeof responseBody.inviteCode !== 'string') {
                return {
                    ok: false,
                    status: 500,
                    message: "POST /invites returned a malformed response"
                };
            }

            return {
                ok: true,
                inviteCode: responseBody.inviteCode
            };
        } catch (err) {
            return {
                ok: false,
                status: 500,
                message: String(err)
            };
        }
    }

    return {
        ok: false,
        status: 500,
        message: "service token refresh failed"
    };
}

router.post('/guilds', requireAuth, requireScope("user"), async (req: Request, res: Response) => {
    const { friendlyName } = req.body;
    if (!isValidGuildName(friendlyName)) {
        res.status(400).json({ error: "friendlyName must be 1-32 printable ASCII characters and cannot start with whitespace" });
        return;
    }

    if (!isDbConnected()) {
        res.status(503).json({ error: "database not connected" });
        return;
    }

    const currentUserID = res.locals.user?.sub;
    if (!currentUserID || typeof currentUserID !== 'string') {
        console.log("POST /guilds missing userID from Beef JWT");
        res.status(500).json({ error: "missing userID from auth token" });
        return;
    }

    const newGuild: Guild = {
        _id: generateSnowflake(),
        friendlyName: friendlyName,
        owner: "",
        members: [],
        channels: [],
        invites: []
    };

    const membershipResult = await addUserGuildMembership(currentUserID, newGuild._id);
    if (!membershipResult.ok) {
        if (membershipResult.status === 409) {
            res.status(409).json({ error: "user guild limit exceeded" });
            return;
        }

        console.log("POST /guilds failed to update user guildMemberships:", membershipResult.status, membershipResult.message);
        res.status(500).json({ error: "failed to update user guild memberships" });
        return;
    }

    newGuild.owner = currentUserID;
    newGuild.members.push(currentUserID);

    try {
        const insertResult = await getCollection<Guild>("guilds").insertOne(newGuild);
        if (!insertResult.acknowledged) {
            res.status(503).json({ error: "failed to insert guild into database" });
            return;
        }
    } catch (err) {
        console.log("POST /guilds error inserting guild:", err);
        res.status(503).json({ error: "failed to insert guild into database" });
        return;
    }

    const inviteResult = await createGuildInvite(newGuild._id);
    if (inviteResult.ok) {
        try {
            const updateResult = await getCollection<Guild>("guilds").updateOne(
                { _id: newGuild._id },
                { $push: { invites: inviteResult.inviteCode } }
            );

            if (updateResult.modifiedCount === 1) {
                newGuild.invites.push(inviteResult.inviteCode);
            } else {
                console.log("POST /guilds failed to attach invite to guild:", updateResult);
            }
        } catch (err) {
            console.log("POST /guilds error attaching invite to guild:", err);
        }
    } else {
        console.log("POST /guilds invite creation failed:", inviteResult.status, inviteResult.message);
    }

    res.status(201).json(newGuild);
});

// :guildID is the route parameter, otherwise we would do /guilds?guildID=123
// 401 code is handled by requireAuth
router.get('/guilds/:guildID', requireAuth, requireScope("user", "service"), async (req: Request, res: Response) => {
    if (!isDbConnected()) {
        // NOTE: Issue says 503 if query failed due to timed out, db offline, etc.
        // but sprint2plan says 503 if can't connect to db, 500 otherwise
        // ill follow sprint2plan but lmk if it should be changed
        res.status(503).json({ error: "database not connected" });
        return;
    }
    const guildIDUnpadded = req.params.guildID;
    // confirm it is string for mongodb, have to do or else ts error
    if (!guildIDUnpadded || typeof guildIDUnpadded !== 'string') {
        res.status(500).json({ error: "guildID is required and must be a string" });
        return;
    }
    const guildID = guildIDUnpadded.padStart(20, "0");
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

router.get('/guilds/:guildID/short', async (req: Request, res: Response) => {
    if (!isDbConnected()) {
        res.status(503).json({ error: "database not connected" });
        return;
    }

    const guildIDUnpadded = req.params.guildID;
    if (!guildIDUnpadded || typeof guildIDUnpadded !== 'string') {
        res.status(400).json({ error: "guildID is required and must be a string" });
        return;
    }

    const guildID = guildIDUnpadded.padStart(20, "0");

    try {
        const guild = await getCollection<Guild>("guilds").findOne({ _id: guildID });
        if (!guild) {
            res.status(404).json({ error: "guild not found" });
            return;
        }

        res.status(200).json({
            _id: guild._id,
            friendlyName: guild.friendlyName
        });
    } catch (err) {
        console.log("GET /guilds/:guildID/short error querying guild:", err);
        res.status(503).json({ error: "failed to query guild from database" });
    }
});

router.post('/guilds/:guildID/members', requireAuth, requireScope("service"), async (req: Request, res: Response) => {
    if (!isDbConnected()) {
        res.status(503).json({ error: "database not connected" });
        return;
    }

    const guildIDUnpadded = req.params.guildID;
    if (!guildIDUnpadded || typeof guildIDUnpadded !== 'string') {
        res.status(400).json({ error: "guildID is required and must be a string" });
        return;
    }

    const { userID } = req.body;
    if (!userID || typeof userID !== 'string') {
        res.status(400).json({ error: "userID is required and must be a string" });
        return;
    }

    const guildID = guildIDUnpadded.padStart(20, "0");
    const normalizedUserID = userID.padStart(20, "0");
    let guild: Guild | null;

    try {
        guild = await getCollection<Guild>("guilds").findOne({ _id: guildID });
    } catch (err) {
        console.log("POST /guilds/:guildID/members error querying guild:", err);
        res.status(503).json({ error: "failed to query guild from database" });
        return;
    }

    if (!guild) {
        res.status(404).json({ error: "guild not found" });
        return;
    }

    if (guild.members.includes(normalizedUserID)) {
        res.status(200).end();
        return;
    }

    const membershipResult = await addUserGuildMembership(normalizedUserID, guildID);
    if (!membershipResult.ok) {
        if (membershipResult.status === 404) {
            res.status(404).json({ error: "guild or user not found" });
            return;
        }

        if (membershipResult.status === 409) {
            res.status(409).json({ error: "user guild limit exceeded" });
            return;
        }

        console.log("POST /guilds/:guildID/members failed to update user guildMemberships:", membershipResult.status, membershipResult.message);
        res.status(500).json({ error: "failed to update user guild memberships" });
        return;
    }

    try {
        const updateResult = await getCollection<Guild>("guilds").updateOne(
            { _id: guildID },
            { $push: { members: normalizedUserID } }
        );

        if (!updateResult.acknowledged || updateResult.modifiedCount !== 1) {
            console.log("POST /guilds/:guildID/members failed to update guild:", updateResult);
            res.status(503).json({ error: "failed to update guild members" });
            return;
        }
    } catch (err) {
        console.log("POST /guilds/:guildID/members error updating guild:", err);
        res.status(503).json({ error: "failed to update guild members" });
        return;
    }

    res.status(201).end();
});

router.post('/guilds/:guildID/channels', requireAuth, requireScope("user"), async (req: Request, res: Response) => {
    const friendlyName = req.body?.friendlyName;
    const type = req.body?.type;

    if (!isValidChannelName(friendlyName)) {
        res.status(400).json({ error: "friendlyName must be 1-32 displayable characters and cannot start with whitespace" });
        return;
    }

    if (!isValidChannelType(type)) {
        res.status(400).json({ error: "type must be either Voice or Text" });
        return;
    }

    const guildIDUnpadded = req.params.guildID;
    if (!guildIDUnpadded || typeof guildIDUnpadded !== 'string') {
        res.status(400).json({ error: "guildID is required and must be a string" });
        return;
    }

    const currentUserID = res.locals.user?.sub;
    if (!currentUserID || typeof currentUserID !== 'string') {
        console.log("POST /guilds/:guildID/channels missing userID from Beef JWT");
        res.status(500).json({ error: "missing userID from auth token" });
        return;
    }

    if (!isDbConnected()) {
        res.status(503).json({ error: "database not connected" });
        return;
    }

    const guildID = guildIDUnpadded.padStart(20, "0");
    let guild: Guild | null;

    try {
        guild = await getCollection<Guild>("guilds").findOne({ _id: guildID });
    } catch (err) {
        console.log("POST /guilds/:guildID/channels error querying guild:", err);
        res.status(503).json({ error: "failed to query guild from database" });
        return;
    }

    if (!guild) {
        res.status(404).json({ error: "guild not found" });
        return;
    }

    if (guild.owner !== currentUserID) {
        res.status(403).json({ error: "only the guild owner can create channels" });
        return;
    }

    const channelsOfThisType = guild.channels.filter(channel => channel.type === type).length;
    if (channelsOfThisType >= getChannelLimit(type)) {
        res.status(409).json({ error: "guild channel limit exceeded" });
        return;
    }

    const newChannel: Channel = {
        _id: generateSnowflake(),
        friendlyName: friendlyName,
        type: type
    };

    try {
        const updateResult = await getCollection<Guild>("guilds").updateOne(
            { _id: guildID },
            { $push: { channels: newChannel } }
        );

        if (!updateResult.acknowledged || updateResult.modifiedCount !== 1) {
            console.log("POST /guilds/:guildID/channels failed to update guild:", updateResult);
            res.status(503).json({ error: "failed to update guild channels" });
            return;
        }
    } catch (err) {
        console.log("POST /guilds/:guildID/channels error updating guild:", err);
        res.status(503).json({ error: "failed to update guild channels" });
        return;
    }

    res.status(201).json(newChannel);
});

router.post('/guilds/:guildID/channels/:channelID/messages', requireAuth, requireScope("user"), async (req: Request, res: Response) => {
    // check if db not connected
    if (!isDbConnected()) {
        res.status(503).json({ error: "database not connected" });
        return;
    }

    const guildIDUnpadded = req.params.guildID;
    const channelIDUnpadded = req.params.channelID;
    
    // validate guildID is string
    if (!guildIDUnpadded || typeof guildIDUnpadded !== 'string') {
        res.status(500).json({ error: "guildID is required and must be a string" });
        return;
    }

    const guildID = guildIDUnpadded.padStart(20, "0");

    // same for channelID
    if (!channelIDUnpadded || typeof channelIDUnpadded !== 'string') {
        res.status(500).json({ error: "channelID is required and must be a string" });
        return;
    }

    const channelID = channelIDUnpadded.padStart(20, "0");

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

router.get('/guilds/:guildID/channels/:channelID/messages', requireAuth, requireScope("user"), async (req: Request, res: Response) => {
    if (!isDbConnected()) {
        res.status(503).json({ error: "database not connected" });
        return;
    }

    const guildIDUnpadded = req.params.guildID;
    const channelIDUnpadded = req.params.channelID;

    // validate guildID is string
    if (!guildIDUnpadded || typeof guildIDUnpadded !== 'string') {
        res.status(500).json({ error: "guildID is required and must be a string" });
        return;
    }

    const guildID = guildIDUnpadded.padStart(20, "0");

    // same for channelID
    if (!channelIDUnpadded || typeof channelIDUnpadded !== 'string') {
        res.status(500).json({ error: "channelID is required and must be a string" });
        return;
    }

    const channelID = channelIDUnpadded.padStart(20, "0");

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

router.post('/guilds/:guildID/channels/:channelID/token', requireAuth, requireScope("user"), async (req: Request, res: Response) => {
    if (!isDbConnected()) {
        res.status(503).json({ error: "database not connected" });
        return;
    }
    const guildIDUnpadded = req.params.guildID
    const channelIDUnpadded = req.params.channelID;
    if(!guildIDUnpadded || !channelIDUnpadded 
      || typeof guildIDUnpadded !== 'string'
      || typeof channelIDUnpadded !== 'string') { // Not sure if this is needed, we can't (to my knowledge) have /token present without both of these
        res.status(400).json({ error: "Missing or malformed guildId/channelId"})
        return
    }

    const channelID = channelIDUnpadded.padStart(20, "0");
    const guildID = guildIDUnpadded.padStart(20, "0");

    // Pasted
    try {
        // find guild
        const guild = await getCollection<Guild>("guilds").findOne({ _id: guildID });
        // 404 if no guild
        if (!guild) {
            res.status(404).json({ error: "guild not found" });
            return;
        }

        // Check if user is in guild
        if(!guild.members.find(u => u === res.locals.user?.sub)) {
            res.status(403).json({ error: "user not in guild"})
            return;
        }

        // find channel in guild
        const channel = guild.channels.find(c => c._id === channelID);
        // 404 if no channel
        if (!channel) {
            res.status(404).json({ error: "channel not found" });
            return;
        }

        let channel_type = "Text"

        if(channel.type && channel.type === "Voice") {
            channel_type = "Voice"
        }

        const token = jwt.sign({"sub":res.locals.user?.sub, "type":channel_type}, secretKey, options)
        res.status(201).json({ token: token });
        
    } catch (err) {
        console.log("Failed to create token", err);
        res.status(500).json({ error: "failed to create token" });
    }

})

export default router;
