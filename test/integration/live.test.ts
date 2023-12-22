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

    test('Update Fields in Filter with Sort and Projection', async() => {
        const collection = client.db(DB_NAME).collection('users');

        // Manually create ObjectId values and add an extra field (e.g., 'location')
        const john = { _id: new ObjectId(), name: 'John', age: 10, location: 'CityA' };
        const jane = { _id: new ObjectId(), name: 'Jane', age: 15, location: 'CityB' };

        // Insert documents with manual _id values
        const documents = [john, jane];
        await collection.insertMany(documents);

        // Find documents by filter with sort and projection
        const filter = { name: 'John' };
        const sort = { age: -1 }; // Sorting by age in descending order
        const projection = { name: 1, age: 1 }; // Projecting name and age fields
        const request = {
            method: 'find',
            params: {
                db: DB_NAME,
                collection: 'users',
                query: filter,
                projection,
                sort
            }
        };

        const response = await axios.post(serverUrl, request);

        // Check response is correct (name and age fields should be returned)
        expect(response.data).toEqual([{
            _id: john._id.toHexString(),
            name: john.name,
            age: john.age
        }]);

        // Update fields that aren't in the filter
        await collection.updateOne(filter, { $set: { age: 5 } }, { writeConcern });

        // Check the updated values of the fields are now returned
        const updatedResponse = await axios.post(serverUrl, request);

        // Check the update has been reflected in the cache
        expect(updatedResponse.data).toEqual([{
            _id: john._id.toHexString(),
            name: john.name,
            age: 5 // Updated age
        }]);
    });

    test('Update Fields Not in the Filter with Skip and Limit', async() => {
        const collection = client.db(DB_NAME).collection('users');

        // Manually create ObjectId values for multiple users
        const users = [
            { _id: new ObjectId(), name: 'John', age: 10 },
            { _id: new ObjectId(), name: 'Jane', age: 15 },
            { _id: new ObjectId(), name: 'Jim', age: 20 },
            { _id: new ObjectId(), name: 'Jill', age: 25 },
            { _id: new ObjectId(), name: 'Jack', age: 30 }
        ];

        // Insert multiple documents
        await collection.insertMany(users);

        // Find documents by filter with skip and limit
        const filter = { name: { $in: ['John', 'Jane', 'Jim', 'Jill', 'Jack'] } };
        const skip = 1; // Skip the first document
        const limit = 2; // Limit to 2 documents
        const request = {
            method: 'find',
            params: {
                db: DB_NAME,
                collection: 'users',
                query: filter,
                skip,
                limit
            }
        };

        const response = await axios.post(serverUrl, request);

        // Check response is correct with the specified skip and limit
        expect(response.data).toEqual([
            JSON.parse(JSON.stringify(users[1])),
            JSON.parse(JSON.stringify(users[2]))
        ]);

        // Update a field in one of the retrieved documents
        await collection.updateOne({ _id: users[1]._id }, { $set: { age: 16 } }, { writeConcern });

        // Check the updated values of the fields are now returned
        const updatedResponse = await axios.post(serverUrl, request);

        // Check the update has been reflected in the cache
        const updatedUser = { ...users[1], age: 16 };
        expect(updatedResponse.data).toEqual([
            JSON.parse(JSON.stringify(updatedUser)),
            JSON.parse(JSON.stringify(users[2]))
        ]);
    });

    test('Update Fields In the Filter', async() => {
        const COLLECTION_NAME = 'users';
        const collection = client.db(DB_NAME).collection(COLLECTION_NAME);

        // Insert initial documents
        const user1 = { _id: new ObjectId(), name: 'User1', age: 20 };
        const user2 = { _id: new ObjectId(), name: 'User2', age: 25 };
        const user3 = { _id: new ObjectId(), name: 'User3', age: 30 };
        const documents = [user1, user2, user3];
        await collection.insertMany(documents);

        // Filter that includes documents based on age
        const filter = { age: { $gt: 18 } };
        const request = {
            method: 'find',
            params: {
                db: DB_NAME,
                collection: COLLECTION_NAME,
                query: filter
            }
        };

        // Initial query to cache the documents
        const initialResponse = await axios.post(serverUrl, request);
        expect(initialResponse.data).toEqual(documents.map(doc => JSON.parse(JSON.stringify(doc))));

        // Update an in-filter field (age) in a way that it still matches the filter
        await collection.updateOne({ _id: user2._id }, { $set: { age: 27 } }, { writeConcern });

        // Query again to check if the cache reflects the updated document
        const updatedResponse = await axios.post(serverUrl, request);

        // Create an updated version of user2 for comparison
        const updatedUser2 = { ...user2, age: 27 };

        // Check that the updated documents are correctly reflected in the cache
        const expectedDocuments = [user1, updatedUser2, user3].map(doc => JSON.parse(JSON.stringify(doc)));
        expect(updatedResponse.data).toEqual(expectedDocuments);
    });

    test('Update Fields In the Filter with Projection and Sorting', async() => {
        const COLLECTION_NAME = 'users';
        const collection = client.db(DB_NAME).collection(COLLECTION_NAME);

        // Insert initial documents
        const user1 = { _id: new ObjectId(), name: 'User1', age: 20, location: 'CityA' };
        const user2 = { _id: new ObjectId(), name: 'User2', age: 25, location: 'CityB' };
        const user3 = { _id: new ObjectId(), name: 'User3', age: 30, location: 'CityC' };
        const user4 = { _id: new ObjectId(), name: 'User4', age: 15, location: 'CityD' }; // Does not meet filter
        const user5 = { _id: new ObjectId(), name: 'User5', age: 16, location: 'CityE' }; // Does not meet filter
        const documents = [user1, user2, user3, user4, user5];
        await collection.insertMany(documents);

        // Filter that includes documents based on age
        const filter = { age: { $gt: 18 } };
        const sort = { age: 1 }; // Sorting by age in ascending order
        const projection = { name: 1, age: 1 }; // Projecting only name and age fields
        const request = {
            method: 'find',
            params: {
                db: DB_NAME,
                collection: COLLECTION_NAME,
                query: filter,
                projection,
                sort
            }
        };

        // Initial query to cache the documents with sorting and projection
        const initialResponse = await axios.post(serverUrl, request);
        const expectedInitialDocs = [user1, user2, user3].map(doc => ({ _id: doc._id.toString(), name: doc.name, age: doc.age })).sort((a, b) => a.age - b.age);
        expect(initialResponse.data).toEqual(expectedInitialDocs);

        // Update an in-filter field (age) in a way that it still matches the filter
        await collection.updateOne({ _id: user2._id }, { $set: { age: 27 } }, { writeConcern });

        // Query again to check if the cache reflects the updated document with sorting and projection
        const updatedResponse = await axios.post(serverUrl, request);

        // Create an updated version of user2 for comparison
        const updatedUser2 = { _id: user2._id.toString(), name: user2.name, age: 27 };

        // Check that the updated documents are correctly reflected in the cache
        const expectedUpdatedDocs = [user1, updatedUser2, user3].map(doc => ({ _id: doc._id.toString(), name: doc.name, age: doc.age })).sort((a, b) => a.age - b.age);
        expect(updatedResponse.data).toEqual(expectedUpdatedDocs);
    });

    test('Update Fields In the Filter with Skip and Limit', async() => {
        const COLLECTION_NAME = 'users';
        const collection = client.db(DB_NAME).collection(COLLECTION_NAME);

        // Insert initial documents, including some that do not meet the filter criteria
        const user1 = { _id: new ObjectId(), name: 'User1', age: 20 };
        const user2 = { _id: new ObjectId(), name: 'User2', age: 25 };
        const user3 = { _id: new ObjectId(), name: 'User3', age: 30 };
        const user4 = { _id: new ObjectId(), name: 'User4', age: 15 }; // Does not meet filter
        const user5 = { _id: new ObjectId(), name: 'User5', age: 16 }; // Does not meet filter
        const documents = [user1, user2, user3, user4, user5];
        await collection.insertMany(documents);

        // Filter that includes documents based on age
        const filter = { age: { $gt: 18 } };
        const skip = 1; // Skip the first document
        const limit = 2; // Limit to 2 documents
        const request = {
            method: 'find',
            params: {
                db: DB_NAME,
                collection: COLLECTION_NAME,
                query: filter,
                skip,
                limit
            }
        };

        // Initial query to cache the documents with skip and limit
        const initialResponse = await axios.post(serverUrl, request);
        const expectedInitialDocs = [user2, user3].map(doc => ({ _id: doc._id.toString(), name: doc.name, age: doc.age })); // User1 is skipped
        expect(initialResponse.data).toEqual(expectedInitialDocs);

        // Update an in-filter field (age) in a way that it still matches the filter
        await collection.updateOne({ _id: user2._id }, { $set: { age: 27 } }, { writeConcern });

        // Query again to check if the cache reflects the updated document with skip and limit
        const updatedResponse = await axios.post(serverUrl, request);

        // Create an updated version of user2 for comparison
        const updatedUser2 = { _id: user2._id.toString(), name: user2.name, age: 27 };

        // Check that the updated documents are correctly reflected in the cache
        const expectedUpdatedDocs = [updatedUser2, user3].map(doc => ({ _id: doc._id.toString(), name: doc.name, age: doc.age }));
        expect(updatedResponse.data).toEqual(expectedUpdatedDocs);
    });

    test('Update Fields Resulting in Document Exclusion from Cache', async() => {
        const COLLECTION_NAME = 'users';
        const collection = client.db(DB_NAME).collection(COLLECTION_NAME);

        // Insert initial documents
        const user1 = { _id: new ObjectId(), name: 'User1', age: 20 };
        const user2 = { _id: new ObjectId(), name: 'User2', age: 25 };
        const user3 = { _id: new ObjectId(), name: 'User3', age: 30 };
        const documents = [user1, user2, user3];
        await collection.insertMany(documents);

        // Filter that includes documents based on age
        const filter = { age: { $gt: 18 } };
        const request = {
            method: 'find',
            params: {
                db: DB_NAME,
                collection: COLLECTION_NAME,
                query: filter
            }
        };

        // Initial query to cache the documents
        const initialResponse = await axios.post(serverUrl, request);
        expect(initialResponse.data).toEqual(documents.map(doc => JSON.parse(JSON.stringify(doc))));

        // Update a document in a way that it no longer matches the filter
        await collection.updateOne({ _id: user2._id }, { $set: { age: 18 } }, { writeConcern });

        // Query again to check if the cache reflects the updated document
        const updatedResponse = await axios.post(serverUrl, request);

        // Check that user2 is no longer in the cache since it doesn't meet the filter criteria
        const expectedDocuments = [user1, user3].map(doc => JSON.parse(JSON.stringify(doc)));
        expect(updatedResponse.data).toEqual(expectedDocuments);
    });

    test('Update Document to Match Filter Criteria and Appear in Cache', async() => {
        const COLLECTION_NAME = 'users';
        const collection = client.db(DB_NAME).collection(COLLECTION_NAME);

        // Insert initial documents
        const user1 = { _id: new ObjectId(), name: 'User1', age: 20 };
        const user2 = { _id: new ObjectId(), name: 'User2', age: 15 }; // Initially does not meet the filter criteria
        const user3 = { _id: new ObjectId(), name: 'User3', age: 30 };
        const documents = [user1, user2, user3];
        await collection.insertMany(documents);

        // Filter that includes documents based on age
        const filter = { age: { $gt: 18 } };
        const request = {
            method: 'find',
            params: {
                db: DB_NAME,
                collection: COLLECTION_NAME,
                query: filter
            }
        };

        // Initial query to cache the documents that meet the filter criteria
        const initialResponse = await axios.post(serverUrl, request);
        const expectedInitialDocs = [user1, user3].map(doc => JSON.parse(JSON.stringify(doc)));
        expect(initialResponse.data).toEqual(expectedInitialDocs);

        // Update user2 to match the filter criteria
        await collection.updateOne({ _id: user2._id }, { $set: { age: 21 } }, { writeConcern });

        await sleep(10);

        // Query again to check if the cache reflects the updated document
        const updatedResponse = await axios.post(serverUrl, request);

        // Check that user2 now appears in the cache
        const updatedUser2 = { ...user2, age: 21 };
        const expectedUpdatedDocs = [user1, user3, updatedUser2].map(doc => JSON.parse(JSON.stringify(doc)));
        expect(updatedResponse.data).toEqual(expectedUpdatedDocs);
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

    test('Check Cache After Deleting a Specific Document', async() => {
        const COLLECTION_NAME = 'users';
        const collection = client.db(DB_NAME).collection(COLLECTION_NAME);

        // Insert multiple documents, including the one to be deleted
        const userToDelete = { _id: new ObjectId(), name: 'UserToDelete', age: 40 };
        const otherUser1 = { _id: new ObjectId(), name: 'OtherUser1', age: 25 };
        const otherUser2 = { _id: new ObjectId(), name: 'OtherUser2', age: 30 };
        const documents = [userToDelete, otherUser1, otherUser2];
        await collection.insertMany(documents);

        // Perform a query to ensure all documents are cached
        const filterForCache = {};
        const cacheQueryRequest = {
            method: 'find',
            params: {
                db: DB_NAME,
                collection: COLLECTION_NAME,
                query: filterForCache
            }
        };

        const initialResponse = await axios.post(serverUrl, cacheQueryRequest);
        expect(initialResponse.data).toEqual(documents.map(doc => JSON.parse(JSON.stringify(doc))));

        // Delete the specific document
        await collection.deleteOne({ _id: userToDelete._id });

        // Query again to check if the cache has been updated correctly
        const updatedResponse = await axios.post(serverUrl, cacheQueryRequest);

        // Expect the cache to return all documents except the deleted one
        const expectedDocuments = [otherUser1, otherUser2].map(doc => JSON.parse(JSON.stringify(doc)));
        expect(updatedResponse.data).toEqual(expectedDocuments);
    });
});
