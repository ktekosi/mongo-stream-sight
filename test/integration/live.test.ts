import { type Db, MongoClient, ObjectId } from 'mongodb';
import axios from 'axios';
import { afterAll, beforeAll, describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { type MongoStreamSightServer, startApp } from '../../src/app.ts';
import { sleep } from 'bun';

describe('Server Integration Tests', () => {
    const serverUrl: string = 'http://localhost:8000';
    const mongoUri: string = 'mongodb://root:password@mongo1,mongo2,mongo3/admin?replicaSet=rs0';
    let client: MongoClient;
    let db: Db;
    let server: MongoStreamSightServer;
    const DB_NAME = 'test';
    const LISTEN_PORT = 8000;

    beforeAll(async() => {
        // Connect to MongoDB
        client = new MongoClient(mongoUri);
        await client.connect();
        db = client.db(DB_NAME);

        // Start the Live Cache Server
        // server = await startApp(LISTEN_PORT, mongoUri);
    });

    afterAll(async() => {
        // Close the MongoDB connection
        await client.close(true);

        // Shutdown the server
        // console.log('Shutting down server');
        // server.shutdown();
    });

    beforeEach(async() => {
        await db.dropDatabase();
    });

    afterEach(async() => {

    });

    test('Update Fields Not in the Filter', async() => {
        const collection = db.collection('users');

        // Manually create ObjectId values
        const john = { _id: new ObjectId(), name: 'John', age: 30 };
        const jane = { _id: new ObjectId(), name: 'Jane', age: 25 };

        // Insert documents with manual _id values
        const documents = [john, jane];
        await collection.insertMany(documents);

        // Find documents by filter
        const filter = { name: 'John' };
        const request = {
            method: 'find',
            params: {
                db: DB_NAME,
                collection: 'users',
                query: filter
            }
        };

        const response = await axios.post(serverUrl, request);

        // Check response is correct
        expect(response.data).toEqual([JSON.parse(JSON.stringify(john))]);

        // Update fields that aren't in the filter
        await collection.updateOne(filter, { $set: { age: 35 } }, { writeConcern: { w: 'majority', journal: true, wtimeoutMS: 100 } });

        await sleep(10);

        // Check the updated values of the fields are now returned
        const updatedResponse = await axios.post(serverUrl, request);

        // Check the update has been reflected in the cache
        expect(updatedResponse.data).toEqual([JSON.parse(JSON.stringify(Object.assign({}, john, { age: 35 })))]);
    });
});
