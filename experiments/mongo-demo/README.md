# MongoDB Demo with Multipass VM

A guide to setting up a MongoDB server on an Ubuntu VM using Multipass (Apple Silicon Mac) and querying it remotely with Node.js.

## Prerequisites

- macOS on Apple Silicon (M1/M2/M3/M4)
- [Homebrew](https://brew.sh) installed
- Node.js installed on your Mac

## 1. Create the Virtual Machine

Install Multipass:

```bash
brew install --cask multipass
```

Launch an Ubuntu 24.04 VM:

```bash
multipass launch 24.04 --name mongo-server --cpus 2 --memory 4G --disk 20G
```

Verify it's running:

```bash
multipass list
```

## 2. Install MongoDB

Shell into the VM:

```bash
multipass shell mongo-server
```

Import the MongoDB GPG key:

```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
```

Add the MongoDB repository:

```bash
echo "deb [ arch=arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
```

Install MongoDB:

```bash
sudo apt update
sudo apt install -y mongodb-org
```

Start MongoDB and enable it on boot:

```bash
sudo systemctl start mongod
sudo systemctl enable mongod
```

Verify it's running:

```bash
sudo systemctl status mongod
```

## 3. Configure Remote Access

Allow connections from outside the VM:

```bash
sudo sed -i 's/bindIp: 127.0.0.1/bindIp: 0.0.0.0/' /etc/mongod.conf
sudo systemctl restart mongod
```

Verify the change:

```bash
grep bindIp /etc/mongod.conf
```

Exit the VM:

```bash
exit
```

## 4. Set Up the Demo Project

Back on your Mac, get the VM's IP:

```bash
multipass info mongo-server | grep IPv4
```

Replace the IP in ```uri``` with the IP above.

Run the demo:

```bash
node demo.js
```

## 5. Verify in the VM

Shell into the VM and check the data directly:

```bash
multipass shell mongo-server
mongosh demo
```

```js
db.users.find()
```

## VM Management

| Command | Description |
|---|---|
| `multipass stop mongo-server` | Stop the VM |
| `multipass start mongo-server` | Start the VM |
| `multipass info mongo-server` | View VM details and IP |
| `multipass delete mongo-server && multipass purge` | Destroy the VM |