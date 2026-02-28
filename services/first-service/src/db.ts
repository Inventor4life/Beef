import { MongoClient, type Collection, type Db } from "mongodb";

let client: MongoClient;
let db: Db;
let messagesCollection: Collection;
let lastMessageId: number = 0;

export async function connectToDb() {
    client = new MongoClient(process.env.MONGO_URI!);
    await client.connect();
    console.log("Connected to MongoDB");
    db = client.db("beef");
    messagesCollection = db.collection("messages");
    // query for the highest meessage id
    const lastMessage = await messagesCollection.findOne({}, { sort: { id: -1 } });
    if (lastMessage) {
        lastMessageId = lastMessage.id as number;
    }

    console.log(`Last message id: ${lastMessageId}`);
}

export async function closeDb() {
    await client.close();
    console.log("Closed MongoDB connection");
}

export function getMessagesCollection() {
    return messagesCollection;
}

export function getNextMessageId() {
    lastMessageId++;
    return lastMessageId;
}