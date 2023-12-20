import { MongoClient, ObjectId, type WriteConcernSettings } from 'mongodb';
import axios from 'axios';
import { afterAll, beforeAll, describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { type MongoStreamSightServer, startApp } from '../../src/app.ts';
import { sleep, type Subprocess } from 'bun';
import waitPort from 'wait-port';

describe('Server Integration Tests', () => {
    const LISTEN_PORT = 8000;
    const MONGO_USERNAME = Bun.env.MONGO_USERNAME ?? 'root';
    const MONGO_PASSWORD = Bun.env.MONGO_PASSWORD ?? 'password';
    const MONGO_HOST = Bun.env.MONGO_HOST ?? 'mongo1,mongo2,mongo3';
    const MONGO_RS = Bun.env.MONGO_RS ?? 'rs0';

    const serverUrl: string = `http://localhost:${LISTEN_PORT}`;
    const mongoUri: string = `mongodb://${MONGO_USERNAME}${MONGO_PASSWORD !== '' ? `:${MONGO_PASSWORD}@` : ''}${MONGO_HOST}/admin?replicaSet=${MONGO_RS}`;
    let client: MongoClient;
    let server: MongoStreamSightServer;
    const DB_NAME = 'test';

    const writeConcern: WriteConcernSettings = { w: 'majority', journal: true, wtimeoutMS: 100 };

    beforeAll(async() => {
        // Connect to MongoDB
        client = new MongoClient(mongoUri);
        await client.connect();
        await client.db(DB_NAME).dropDatabase();
        // Start the Live Cache Server
        server = await startApp(LISTEN_PORT, mongoUri);
    });

    afterAll(async() => {
        // Close the MongoDB connection
        await client.close(true);

        // Shutdown the server
        // console.log('Shutting down server');
        server.shutdown();
    });

    beforeEach(async() => {
        await client.db(DB_NAME).dropDatabase();
    });

    afterEach(async() => {

    });

    test('Update Fields Not in the Filter', async() => {
        const collection = client.db(DB_NAME).collection('users');

        // Manually create ObjectId values
        const john = { _id: new ObjectId(), name: 'John', age: 10 };
        const jane = { _id: new ObjectId(), name: 'Jane', age: 15 };

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
        await collection.updateOne(filter, { $set: { age: 5 } }, { writeConcern });

        // Check the updated values of the fields are now returned
        const updatedResponse = await axios.post(serverUrl, request);

        // Check the update has been reflected in the cache
        expect(updatedResponse.data).toEqual([JSON.parse(JSON.stringify(Object.assign({}, john, { age: 5 })))]);
    });

    test('Check for Newly Inserted Documents', async() => {
        const COLLECTION_NAME = 'users';
        const collection = client.db(DB_NAME).collection(COLLECTION_NAME);

        // Pre-existing documents
        const existingUser = { _id: new ObjectId(), name: 'Existing', age: 30 };
        await collection.insertOne(existingUser);

        // Find documents by filter
        const filter = { age: { $gt: 20 } };
        const request = {
            method: 'find',
            params: {
                db: DB_NAME,
                collection: COLLECTION_NAME,
                query: filter
            }
        };

        const initialResponse = await axios.post(serverUrl, request);
        expect(initialResponse.data).toEqual([JSON.parse(JSON.stringify(existingUser))]);

        // await sleep(1000);

        // Insert new documents, some of which match the filter
        const newUser1 = { _id: new ObjectId(), name: 'NewUser1', age: 25 }; // This should match
        const newUser2 = { _id: new ObjectId(), name: 'NewUser2', age: 18 }; // This should not match
        const newUser3 = { _id: new ObjectId(), name: 'NewUser3', age: 30 }; // This should match
        const newDocuments = [newUser1, newUser2, newUser3];
        await collection.insertMany(newDocuments, { writeConcern });

        // Check that only the new documents matching the filter are returned
        const updatedResponse = await axios.post(serverUrl, request);
        const expectedDocuments = [existingUser, newUser1, newUser3].map(doc => JSON.parse(JSON.stringify(doc)));
        expect(updatedResponse.data).toEqual(expectedDocuments);
    });
});
