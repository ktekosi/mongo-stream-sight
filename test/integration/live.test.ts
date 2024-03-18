import { type Collection, type Document, MongoClient, ObjectId, type WriteConcernSettings } from 'mongodb';
import axios from 'axios';
import { afterAll, beforeAll, describe, test, expect, afterEach, beforeEach } from 'bun:test';
import { type MongoStreamSightServer, startApp } from '../../src/app.ts';
import { sleep } from 'bun';
import { denormalize, normalize } from '../../src/converter.ts';

type OperationFunction<T> = () => Promise<T>;
type OperationChecker<T> = (value: T) => boolean;

async function retryOperation<T>(op: OperationFunction<T>, check: OperationChecker<T>, retries: number, sleepTime: number): Promise<void> {
    let result: T;

    for (let i = 0; i < retries; i++) {
        if (i > 1) console.log(`Retry ${i + 1} of ${retries}`);
        result = await op();

        if (check(result)) {
            return;
        }

        await sleep(sleepTime);
    }
}

describe('Server Integration Tests', () => {
    interface User {
        _id: ObjectId
        name?: string
        age?: number
        location?: string
    }

    const LISTEN_PORT = parseInt(Bun.env.LISTEN_PORT ?? '8000');
    const MONGO_USERNAME = Bun.env.MONGO_USERNAME ?? 'root';
    const MONGO_PASSWORD = Bun.env.MONGO_PASSWORD ?? 'password';
    const MONGO_HOST = Bun.env.MONGO_HOST ?? 'mongo1,mongo2,mongo3';
    const MONGO_RS = Bun.env.MONGO_RS ?? 'rs0';
    const SERVER_HOSTNAME = Bun.env.SERVER_HOSTNAME ?? 'localhost';
    const USE_EXTERNAL_SERVER = (Bun.env.USE_EXTERNAL_SERVER ?? 'false') === 'true';
    const SLEEP_WAIT_TIME = parseInt(Bun.env.SLEEP_WAIT_TIME ?? '50');
    const RETRY_COUNT = parseInt(Bun.env.RETRY_COUNT ?? '10');

    const serverUrl: string = `http://${SERVER_HOSTNAME}:${LISTEN_PORT}`;
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

        if (!USE_EXTERNAL_SERVER) {
            // Start the Live Cache Server
            server = await startApp(LISTEN_PORT, mongoUri);
        }
    });

    afterAll(async() => {
        // Close the MongoDB connection
        await client.close(true);

        // Shutdown the server
        if (!USE_EXTERNAL_SERVER) {
            server.shutdown();
        }
    });

    beforeEach(async() => {
        await client.db(DB_NAME).dropDatabase();
    });

    afterEach(async() => {

    });

    interface FindParams {
        db: string
        collection: string
        query: Document
        projection?: Document
        skip?: number
        limit?: number
        sort?: Document
        ttl?: number
    }

    interface IntegrationTestCase {
        name: string
        documentsToInsert: User[]
        initialDocuments: User[]
        findParams: FindParams
        modifyAction: (collection: Collection) => Promise<void>
        expectedDocuments: User[]
    }

    const defaultFindParams = {
        db: DB_NAME,
        collection: 'users'
    };

    function projectAndSortUsers(users: User[], projection: Record<string, number>, sort: Record<string, number>): User[] {
        return users
            .sort((a: Record<string, any>, b: Record<string, any>) => {
                return Object.entries(sort).reduce((compareResult, [field, dir]) =>
                    compareResult === 0 ? ((a[field] ?? 0) - (b[field] ?? 0)) * dir : compareResult
                , 0);
            })
            .map(user => Object.fromEntries(Object.entries(user).filter(([field, _]) => projection[field] === 1 || field === '_id')) as User);
    }

    const integrationTests: IntegrationTestCase[] = [
        ((): IntegrationTestCase => {
            const john: User = { _id: new ObjectId(), name: 'John', age: 10 };
            const jane: User = { _id: new ObjectId(), name: 'Jane', age: 15 };
            const query = { name: 'John' };
            return {
                name: 'Update Fields Not in the Filter',
                documentsToInsert: [john, jane],
                findParams: {
                    ...defaultFindParams,
                    query
                },
                initialDocuments: [john],
                modifyAction: async(collection: Collection) => {
                    await collection.updateOne(query, { $set: { age: 5 } }, { writeConcern });
                },
                expectedDocuments: [Object.assign({}, john, { age: 5 })]
            };
        })(),
        ((): IntegrationTestCase => {
            const john = { _id: new ObjectId(), name: 'John', age: 10, location: 'CityA' };
            const jane = { _id: new ObjectId(), name: 'Jane', age: 15, location: 'CityB' };
            const query = { name: 'John' };
            const projection = { name: 1, age: 1 };
            const sort = { age: -1 };
            const projectedJohn = {
                _id: john._id,
                name: john.name,
                age: john.age
            };
            return {
                name: 'Update Fields Not in the Filter with Sort and Projection',
                documentsToInsert: [john, jane],
                findParams: {
                    ...defaultFindParams,
                    query,
                    projection,
                    sort
                },
                initialDocuments: [projectedJohn],
                modifyAction: async(collection: Collection) => {
                    await collection.updateOne(query, { $set: { age: 5 } }, { writeConcern });
                },
                expectedDocuments: [{
                    ...projectedJohn,
                    age: 5
                }]
            };
        })(),
        ((): IntegrationTestCase => {
            const users = [
                { _id: new ObjectId(), name: 'John', age: 10 },
                { _id: new ObjectId(), name: 'Jane', age: 15 },
                { _id: new ObjectId(), name: 'Jim', age: 20 },
                { _id: new ObjectId(), name: 'Jill', age: 25 },
                { _id: new ObjectId(), name: 'Jack', age: 30 }
            ];
            const updatedUser = { ...users[1], age: 16 };
            return {
                name: 'Update Fields Not in the Filter with Skip and Limit',
                documentsToInsert: users,
                findParams: {
                    ...defaultFindParams,
                    query: { name: { $in: ['John', 'Jane', 'Jim', 'Jill', 'Jack'] } },
                    skip: 1,
                    limit: 2
                },
                initialDocuments: [
                    users[1],
                    users[2]
                ],
                modifyAction: async(collection: Collection) => {
                    await collection.updateOne({ _id: updatedUser._id }, { $set: { age: updatedUser.age } }, { writeConcern });
                },
                expectedDocuments: [
                    updatedUser,
                    users[2]
                ]

            };
        })(),
        ((): IntegrationTestCase => {
            const user1 = { _id: new ObjectId(), name: 'User1', age: 20 };
            const user2 = { _id: new ObjectId(), name: 'User2', age: 25 };
            const user3 = { _id: new ObjectId(), name: 'User3', age: 30 };
            const users = [user1, user2, user3];
            const updatedUser2 = { ...user2, age: 27 };
            return {
                name: 'Update Fields in the Filter',
                documentsToInsert: users,
                findParams: {
                    ...defaultFindParams,
                    query: { age: { $gt: 18 } }
                },
                initialDocuments: users,
                modifyAction: async(collection: Collection) => {
                    await collection.updateOne({ _id: updatedUser2._id }, { $set: { age: updatedUser2.age } }, { writeConcern });
                },
                expectedDocuments: [user1, updatedUser2, user3]
            };
        })(),
        ((): IntegrationTestCase => {
            const user1 = { _id: new ObjectId(), name: 'User1', age: 20, location: 'CityA' };
            const user2 = { _id: new ObjectId(), name: 'User2', age: 25, location: 'CityB' };
            const user3 = { _id: new ObjectId(), name: 'User3', age: 30, location: 'CityC' };
            const user4 = { _id: new ObjectId(), name: 'User4', age: 15, location: 'CityD' }; // Does not meet filter
            const user5 = { _id: new ObjectId(), name: 'User5', age: 16, location: 'CityE' }; // Does not meet filter
            const users = [user1, user2, user3, user4, user5];
            const updatedUser2 = { ...user2, age: 27 };
            const projection = { name: 1, age: 1 };
            const sort = { age: 1 };
            return {
                name: 'Update Fields in the Filter with Projection and Sorting',
                documentsToInsert: users,
                findParams: {
                    ...defaultFindParams,
                    query: { age: { $gt: 18 } },
                    sort,
                    projection
                },
                initialDocuments: projectAndSortUsers([user1, user2, user3], projection, sort),
                modifyAction: async(collection: Collection) => {
                    await collection.updateOne({ _id: updatedUser2._id }, { $set: { age: updatedUser2.age } }, { writeConcern });
                },
                expectedDocuments: projectAndSortUsers([user1, updatedUser2, user3], projection, sort)
            };
        })(),
        ((): IntegrationTestCase => {
            const user1 = { _id: new ObjectId(), name: 'User1', age: 20, location: 'CityA' };
            const user2 = { _id: new ObjectId(), name: 'User2', age: 25, location: 'CityB' };
            const user3 = { _id: new ObjectId(), name: 'User3', age: 30, location: 'CityC' };
            const user4 = { _id: new ObjectId(), name: 'User4', age: 15, location: 'CityD' }; // Does not meet filter
            const user5 = { _id: new ObjectId(), name: 'User5', age: 16, location: 'CityE' }; // Does not meet filter
            const users = [user1, user2, user3, user4, user5];
            const updatedUser2 = { ...user2, age: 27 };
            return {
                name: 'Update Fields in the Filter with Skip and Limit',
                documentsToInsert: users,
                findParams: {
                    ...defaultFindParams,
                    query: { age: { $gt: 18 } },
                    skip: 1,
                    limit: 2
                },
                initialDocuments: [user2, user3],
                modifyAction: async(collection: Collection) => {
                    await collection.updateOne({ _id: updatedUser2._id }, { $set: { age: updatedUser2.age } }, { writeConcern });
                },
                expectedDocuments: [updatedUser2, user3]
            };
        })(),
        ((): IntegrationTestCase => {
            const user1 = { _id: new ObjectId(), name: 'User1', age: 20 };
            const user2 = { _id: new ObjectId(), name: 'User2', age: 25 };
            const user3 = { _id: new ObjectId(), name: 'User3', age: 30 };
            const users = [user1, user2, user3];
            const updatedUser2 = { ...user2, age: 18 };
            return {
                name: 'Update Fields Resulting in Document Exclusion from Cache',
                documentsToInsert: users,
                findParams: {
                    ...defaultFindParams,
                    query: { age: { $gt: 18 } }
                },
                initialDocuments: users,
                modifyAction: async(collection: Collection) => {
                    await collection.updateOne({ _id: updatedUser2._id }, { $set: { age: updatedUser2.age } }, { writeConcern });
                },
                expectedDocuments: [user1, user3]
            };
        })(),
        ((): IntegrationTestCase => {
            const user1 = { _id: new ObjectId(), name: 'User1', age: 20, location: 'CityA' };
            const user2 = { _id: new ObjectId(), name: 'User2', age: 25, location: 'CityB' };
            const user3 = { _id: new ObjectId(), name: 'User3', age: 30, location: 'CityC' };
            const user4 = { _id: new ObjectId(), name: 'User4', age: 15, location: 'CityD' }; // Does not meet filter
            const user5 = { _id: new ObjectId(), name: 'User5', age: 16, location: 'CityE' }; // Does not meet filter
            const users = [user1, user2, user3, user4, user5];
            const updatedUser2 = { ...user2, age: 18 };
            const sort = { age: 1 };
            const projection = { name: 1, age: 1 };

            return {
                name: 'Update Fields Resulting in Document Exclusion from Cache with Projection and Sorting',
                documentsToInsert: users,
                findParams: {
                    ...defaultFindParams,
                    query: { age: { $gt: 18 } },
                    projection,
                    sort
                },
                initialDocuments: projectAndSortUsers([user1, user2, user3], projection, sort),
                modifyAction: async(collection: Collection) => {
                    await collection.updateOne({ _id: updatedUser2._id }, { $set: { age: updatedUser2.age } }, { writeConcern });
                },
                expectedDocuments: projectAndSortUsers([user1, user3], projection, sort)
            };
        })(),
        ((): IntegrationTestCase => {
            const user1 = { _id: new ObjectId(), name: 'User1', age: 20, location: 'CityA' };
            const user2 = { _id: new ObjectId(), name: 'User2', age: 25, location: 'CityB' };
            const user3 = { _id: new ObjectId(), name: 'User3', age: 30, location: 'CityC' };
            const user4 = { _id: new ObjectId(), name: 'User4', age: 15, location: 'CityD' }; // Does not meet filter
            const user5 = { _id: new ObjectId(), name: 'User5', age: 16, location: 'CityE' }; // Does not meet filter
            const users = [user1, user2, user3, user4, user5];
            const updatedUser2 = { ...user2, age: 18 };
            return {
                name: 'Update Fields Resulting in Document Exclusion from Cache with Skip and Limit',
                documentsToInsert: users,
                findParams: {
                    ...defaultFindParams,
                    query: { age: { $gt: 18 } },
                    skip: 1,
                    limit: 2
                },
                initialDocuments: [user2, user3],
                modifyAction: async(collection: Collection) => {
                    await collection.updateOne({ _id: updatedUser2._id }, { $set: { age: updatedUser2.age } }, { writeConcern });
                },
                expectedDocuments: [user3]
            };
        })(),
        ((): IntegrationTestCase => {
            const user1 = { _id: new ObjectId(), name: 'User1', age: 20 };
            const user2 = { _id: new ObjectId(), name: 'User2', age: 15 }; // Initially does not meet the filter criteria
            const user3 = { _id: new ObjectId(), name: 'User3', age: 30 };
            const users = [user1, user2, user3];
            const updatedUser2 = { ...user2, age: 21 };
            return {
                name: 'Update Document to Match Filter Criteria and Appear in Cache',
                documentsToInsert: users,
                findParams: {
                    ...defaultFindParams,
                    query: { age: { $gt: 18 } }
                },
                initialDocuments: [user1, user3],
                modifyAction: async(collection: Collection) => {
                    await collection.updateOne({ _id: updatedUser2._id }, { $set: { age: updatedUser2.age } }, { writeConcern });
                },
                expectedDocuments: [user1, user3, updatedUser2]
            };
        })(),
        ((): IntegrationTestCase => {
            const user1 = { _id: new ObjectId(), name: 'User1', age: 20, location: 'CityA' };
            const user2 = { _id: new ObjectId(), name: 'User2', age: 15, location: 'CityB' }; // Initially does not meet the filter criteria
            const user3 = { _id: new ObjectId(), name: 'User3', age: 30, location: 'CityC' };
            const users = [user1, user2, user3];
            const updatedUser2 = { ...user2, age: 21 };
            const projection = { name: 1, age: 1 };
            const sort = { age: 1 };
            return {
                name: 'Update Document to Match Filter Criteria and Appear in Cache with Projection and Sorting',
                documentsToInsert: users,
                findParams: {
                    ...defaultFindParams,
                    query: { age: { $gt: 18 } },
                    projection,
                    sort
                },
                initialDocuments: projectAndSortUsers([user1, user3], projection, sort),
                modifyAction: async(collection: Collection) => {
                    await collection.updateOne({ _id: updatedUser2._id }, { $set: { age: updatedUser2.age } }, { writeConcern });
                },
                expectedDocuments: projectAndSortUsers([user1, user3, updatedUser2], projection, sort)
            };
        })(),
        ((): IntegrationTestCase => {
            const user1 = { _id: new ObjectId(), name: 'User1', age: 20 };
            const user2 = { _id: new ObjectId(), name: 'User2', age: 15 }; // Initially does not meet the filter criteria
            const user3 = { _id: new ObjectId(), name: 'User3', age: 30 };
            const user4 = { _id: new ObjectId(), name: 'User4', age: 35 }; // Additional user for skip and limit testing
            const users = [user1, user2, user3, user4];
            const updatedUser2 = { ...user2, age: 21 };
            const sort = { age: -1 };
            return {
                name: 'Update Document to Match Filter Criteria and Appear in Cache with Skip, Limit, and Sorting',
                documentsToInsert: users,
                findParams: {
                    ...defaultFindParams,
                    query: { age: { $gt: 18 } },
                    skip: 1,
                    limit: 2,
                    sort
                },
                initialDocuments: [user3, user1],
                modifyAction: async(collection: Collection) => {
                    await collection.updateOne({ _id: updatedUser2._id }, { $set: { age: updatedUser2.age } }, { writeConcern });
                },
                expectedDocuments: [user3, updatedUser2]
            };
        })(),
        ((): IntegrationTestCase => {
            const user1 = { _id: new ObjectId(), name: 'User1', age: 20 };
            const user2 = { _id: new ObjectId(), name: 'User2', age: 21 };
            const user3 = { _id: new ObjectId(), name: 'User3', age: 15 };
            const user4 = { _id: new ObjectId(), name: 'User4', age: 35 };
            return {
                name: 'Check for Newly Inserted Documents',
                documentsToInsert: [user1],
                findParams: {
                    ...defaultFindParams,
                    query: { age: { $gt: 18 } }
                },
                initialDocuments: [user1],
                modifyAction: async(collection: Collection) => {
                    await collection.insertMany([user2, user3, user4], { writeConcern });
                },
                expectedDocuments: [user1, user2, user4]
            };
        })(),
        ((): IntegrationTestCase => {
            const user1 = { _id: new ObjectId(), name: 'User1', age: 20, location: 'CityA' };
            const user2 = { _id: new ObjectId(), name: 'User2', age: 21, location: 'CityB' };
            const user3 = { _id: new ObjectId(), name: 'User3', age: 15, location: 'CityC' };
            const user4 = { _id: new ObjectId(), name: 'User4', age: 35, location: 'CityD' };
            const projection = { name: 1, age: 1 };
            const sort = { age: -1 };
            return {
                name: 'Check for Newly Inserted Documents with Projection and Sorting',
                documentsToInsert: [user1],
                findParams: {
                    ...defaultFindParams,
                    query: { age: { $gt: 18 } },
                    projection,
                    sort
                },
                initialDocuments: projectAndSortUsers([user1], projection, sort),
                modifyAction: async(collection: Collection) => {
                    await collection.insertMany([user2, user3, user4], { writeConcern });
                },
                expectedDocuments: projectAndSortUsers([user1, user2, user4], projection, sort)
            };
        })(),
        ((): IntegrationTestCase => {
            const user1 = { _id: new ObjectId(), name: 'User1', age: 20 };
            const user2 = { _id: new ObjectId(), name: 'User2', age: 21 };
            const user3 = { _id: new ObjectId(), name: 'User3', age: 15 };
            const user4 = { _id: new ObjectId(), name: 'User4', age: 35 };
            return {
                name: 'Check for Newly Inserted Documents with Skip and Limit',
                documentsToInsert: [user1],
                findParams: {
                    ...defaultFindParams,
                    query: { age: { $gt: 18 } },
                    skip: 1,
                    limit: 1
                },
                initialDocuments: [],
                modifyAction: async(collection: Collection) => {
                    await collection.insertMany([user2, user3, user4], { writeConcern });
                },
                expectedDocuments: [user2]
            };
        })(),
        ((): IntegrationTestCase => {
            const user1 = { _id: new ObjectId(), name: 'User1', age: 20 };
            const user2 = { _id: new ObjectId(), name: 'User2', age: 21 };
            const user3 = { _id: new ObjectId(), name: 'User3', age: 15 };
            return {
                name: 'Check Cache After Deleting a Specific Document',
                documentsToInsert: [user1, user2, user3],
                findParams: {
                    ...defaultFindParams,
                    query: {}
                },
                initialDocuments: [user1, user2, user3],
                modifyAction: async(collection: Collection) => {
                    await collection.deleteOne({ _id: user1._id }, { writeConcern });
                },
                expectedDocuments: [user2, user3]
            };
        })(),
        ((): IntegrationTestCase => {
            const user1 = { _id: new ObjectId(), name: 'User1', age: 20, location: 'CityA' };
            const user2 = { _id: new ObjectId(), name: 'User2', age: 21, location: 'CityB' };
            const user3 = { _id: new ObjectId(), name: 'User3', age: 15, location: 'CityC' };
            const projection = { name: 1, age: 1 };
            const sort = { age: -1 };

            return {
                name: 'Check Cache After Deleting a Specific Document with Projection and Sorting',
                documentsToInsert: [user1, user2, user3],
                findParams: {
                    ...defaultFindParams,
                    query: {},
                    projection,
                    sort
                },
                initialDocuments: projectAndSortUsers([user1, user2, user3], projection, sort),
                modifyAction: async(collection: Collection) => {
                    await collection.deleteOne({ _id: user1._id }, { writeConcern });
                },
                expectedDocuments: projectAndSortUsers([user2, user3], projection, sort)
            };
        })(),
        ((): IntegrationTestCase => {
            const user1 = { _id: new ObjectId(), name: 'User1', age: 20 };
            const user2 = { _id: new ObjectId(), name: 'User2', age: 21 };
            const user3 = { _id: new ObjectId(), name: 'User3', age: 15 };
            const sort = { age: 1 };
            return {
                name: 'Check Cache After Deleting a Specific Document with Skip, Limit, and Sorting',
                documentsToInsert: [user1, user2, user3],
                findParams: {
                    ...defaultFindParams,
                    query: {},
                    skip: 1,
                    limit: 1,
                    sort
                },
                initialDocuments: [user1],
                modifyAction: async(collection: Collection) => {
                    await collection.deleteOne({ _id: user1._id }, { writeConcern });
                },
                expectedDocuments: [user2]
            };
        })(),
        ((): IntegrationTestCase => {
            const john: User = { _id: new ObjectId(), name: 'John', age: 10 };
            const jane: User = { _id: new ObjectId(), name: 'Jane', age: 15 };
            const query = { _id: john._id };
            return {
                name: 'Can filter on _id',
                documentsToInsert: [john, jane],
                findParams: {
                    ...defaultFindParams,
                    query: normalize(query)
                },
                initialDocuments: [john],
                modifyAction: async(collection: Collection) => {
                    await collection.updateOne(query, { $set: { age: 5 } }, { writeConcern });
                },
                expectedDocuments: [Object.assign({}, john, { age: 5 })]
            };
        })()
    ];

    integrationTests.forEach((integrationTest) => {
        test('find: ' + integrationTest.name, async() => {
            const collection = client.db(DB_NAME).collection('users');
            await collection.insertMany(integrationTest.documentsToInsert, { writeConcern });

            const request = {
                method: 'find',
                params: integrationTest.findParams
            };

            // retry find several times until the documents have reached the cache
            await retryOperation(async() => await axios.post(serverUrl, request),
                response => {
                    const result = response.data.result ?? undefined;
                    return JSON.stringify(result) === JSON.stringify(normalize(integrationTest.initialDocuments));
                },
                RETRY_COUNT, SLEEP_WAIT_TIME);

            const response = await axios.post(serverUrl, request);

            // Check response is correct
            expect(denormalize(response.data.result ?? undefined)).toEqual(integrationTest.initialDocuments);

            await integrationTest.modifyAction(collection);

            const expectedDocuments = integrationTest.expectedDocuments;

            // retry find several times until the updates have reached the cache
            await retryOperation(async() => await axios.post(serverUrl, request),
                response => {
                    const result = response.data.result ?? undefined;
                    return JSON.stringify(result) === JSON.stringify(normalize(expectedDocuments));
                },
                RETRY_COUNT, SLEEP_WAIT_TIME);

            const updatedResponse = await axios.post(serverUrl, request);

            // Check the update has been reflected in the cache
            expect(denormalize(updatedResponse.data.result ?? undefined)).toEqual(expectedDocuments);
        });

        test('count: ' + integrationTest.name, async() => {
            const collection = client.db(DB_NAME).collection('users');
            await collection.insertMany(integrationTest.documentsToInsert, { writeConcern });

            const request = {
                method: 'count',
                params: integrationTest.findParams
            };

            // retry find several times until the documents have reached the cache
            await retryOperation(async() => await axios.post(serverUrl, request),
                response => {
                    const result = response.data.result ?? undefined;
                    return result === integrationTest.initialDocuments.length;
                },
                RETRY_COUNT, SLEEP_WAIT_TIME);

            const response = await axios.post(serverUrl, request);

            // Check response is correct
            expect((response.data.result ?? undefined)).toEqual(integrationTest.initialDocuments.length);

            await integrationTest.modifyAction(collection);

            const expectedDocuments = integrationTest.expectedDocuments;

            // retry find several times until the updates have reached the cache
            await retryOperation(async() => await axios.post(serverUrl, request),
                response => {
                    const result = response.data.result ?? undefined;
                    return (result) === (expectedDocuments.length);
                },
                RETRY_COUNT, SLEEP_WAIT_TIME);

            const updatedResponse = await axios.post(serverUrl, request);

            // Check the update has been reflected in the cache
            expect(updatedResponse.data.result ?? undefined).toEqual(expectedDocuments.length);
        });
    });
});
