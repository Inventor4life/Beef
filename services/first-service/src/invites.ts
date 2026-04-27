import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireScope } from './middleware.js';
import { getCollection, isDbConnected } from './db.js';
import { generateSnowflake } from './snowflake.js';
import { generateServiceToken, getLocalUrl, getServiceAgent } from './auth.js';

interface Invite {
    _id: string;
    guildID: string;
}

type AddMemberResult =
    | { ok: true; status: 200 | 201 }
    | { ok: false; status: number; message: string };

const router = Router();
let serviceToken = generateServiceToken();

function inviteResponse(invite: Invite) {
    return {
        inviteCode: invite._id,
        guildID: invite.guildID
    };
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

async function addMemberToGuild(guildID: string, userID: string): Promise<AddMemberResult> {
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const response = await fetch(
                getLocalUrl(`/guilds/${encodeURIComponent(guildID)}/members`),
                makeServicePostRequest({ userID: userID })
            );

            if (response.status === 401 && attempt === 0) {
                serviceToken = generateServiceToken();
                continue;
            }

            if (response.status === 200 || response.status === 201) {
                return {
                    ok: true,
                    status: response.status
                };
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

    res.status(201).json(inviteResponse(invite));
});

router.get('/invites/:inviteCode', async (req: Request, res: Response) => {
    if (!isDbConnected()) {
        res.status(503).json({ error: "database not connected" });
        return;
    }

    const inviteCodeUnpadded = req.params.inviteCode;
    if (!inviteCodeUnpadded || typeof inviteCodeUnpadded !== 'string') {
        res.status(400).json({ error: "inviteCode is required and must be a string" });
        return;
    }

    const inviteCode = inviteCodeUnpadded.padStart(20, "0");

    try {
        const invite = await getCollection<Invite>("invites").findOne({ _id: inviteCode });
        if (!invite) {
            res.status(404).json({ error: "invite not found" });
            return;
        }

        res.status(200).json(inviteResponse(invite));
    } catch (err) {
        console.log("GET /invites/:inviteCode error querying invite:", err);
        res.status(503).json({ error: "failed to query invite from database" });
    }
});

router.post('/invites/:inviteCode', requireAuth, requireScope("user"), async (req: Request, res: Response) => {
    if (!isDbConnected()) {
        res.status(503).json({ error: "database not connected" });
        return;
    }

    const inviteCodeUnpadded = req.params.inviteCode;
    if (!inviteCodeUnpadded || typeof inviteCodeUnpadded !== 'string') {
        res.status(400).json({ error: "inviteCode is required and must be a string" });
        return;
    }

    const currentUserID = res.locals.user?.sub;
    if (!currentUserID || typeof currentUserID !== 'string') {
        console.log("POST /invites/:inviteCode missing userID from Beef JWT");
        res.status(500).json({ error: "missing userID from auth token" });
        return;
    }

    const inviteCode = inviteCodeUnpadded.padStart(20, "0");
    let invite: Invite | null;

    try {
        invite = await getCollection<Invite>("invites").findOne({ _id: inviteCode });
    } catch (err) {
        console.log("POST /invites/:inviteCode error querying invite:", err);
        res.status(503).json({ error: "failed to query invite from database" });
        return;
    }

    if (!invite) {
        res.status(404).json({ error: "invite not found" });
        return;
    }

    const addMemberResult = await addMemberToGuild(invite.guildID, currentUserID);
    if (addMemberResult.ok) {
        res.status(addMemberResult.status).end();
        return;
    }

    if (addMemberResult.status === 404) {
        res.status(404).json({ error: "invite or guild not found" });
        return;
    }

    if (addMemberResult.status === 409) {
        res.status(409).json({ error: "user guild limit exceeded" });
        return;
    }

    console.log("POST /invites/:inviteCode failed to add guild member:", addMemberResult.status, addMemberResult.message);
    res.status(500).json({ error: "failed to accept invite" });
});

export default router;
