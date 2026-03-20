import { MongoClient, type Collection, type Db } from "mongodb";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectToDb() {
    client = new MongoClient(process.env.MONGO_URI!);
    await client.connect();
    db = client.db("beef");
    console.log("Connected to MongoDB");
}

export function isDbConnected() {
    return client !== null && db !== null;
}

export function getDb() {
    if (!db) {
        throw new Error("Database not connected");
    }
    return db;
}

// should be changed later prolly to add generics for type safety, for now though it just returns document
export function getCollection(name: string): Collection {
    return getDb().collection(name);
}

export async function closeDb() {
    if (client) {
        await client.close();
        client = null;
        db = null;
        console.log("Closed MongoDB connection");
    }
}