// Generative AI was utilized to generate this code
const { MongoClient } = require("mongodb");

const uri = "mongodb://192.168.2.2";
const client = new MongoClient(uri);

async function main() {
  try {
    await client.connect();
    console.log("Connected to MongoDB!\n");

    const db = client.db("demo");
    const users = db.collection("users");

    // Clear any previous demo data
    await users.deleteMany({});

    // Insert documents
    await users.insertMany([
      { name: "Alice", age: 30, role: "engineer" },
      { name: "Bob", age: 25, role: "designer" },
      { name: "Charlie", age: 35, role: "engineer" },
    ]);
    console.log("Inserted 3 users.");

    // Query all users
    console.log("\nAll users:");
    const allUsers = await users.find().toArray();
    console.log(allUsers);

    // Query with a filter
    console.log("\nEngineers only:");
    const engineers = await users.find({ role: "engineer" }).toArray();
    console.log(engineers);

    // Update a document
    await users.updateOne({ name: "Bob" }, { $set: { age: 26 } });
    console.log("\nUpdated Bob's age to 26.");

    // Find one
    const bob = await users.findOne({ name: "Bob" });
    console.log("Bob:", bob);
  } finally {
    await client.close();
    console.log("\nConnection closed.");
  }
}

main().catch(console.error);