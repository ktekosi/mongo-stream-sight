# MongoStreamSight: Real-Time MongoDB Query Caching

**MongoStreamSight** is an innovative Docker image designed to revolutionize the way MongoDB queries are cached and managed. Leveraging real-time caching mechanisms and a JSON-RPC API, it offers seamless and efficient data retrieval directly from your database. This server is a game-changer for applications requiring high-performance data access and real-time updates without the overhead of managing cache invalidation.

## Key Features:

- **Real-Time Caching**: MongoStreamSight caches the complete results of your MongoDB queries in memory. This allows for instantaneous access to data, making your applications faster and more responsive.

- **Efficient Data Retrieval**: Utilizing a JSON-RPC API, MongoStreamSight supports the `find` method for querying your MongoDB database. It simplifies the process of fetching data with an easy-to-use JSON format for requests.

- **MongoDB Replica Set Integration**: Designed to work with MongoDB replica sets, MongoStreamSight subscribes to change streams, ensuring your cache is always up-to-date with the latest data from your database without manual invalidation.

- **Intelligent Query Handling**: Upon the first request, MongoStreamSight performs the full MongoDB query and subscribes to the change stream to update the cache automatically. Subsequent requests for the same query are served directly from the cache, significantly reducing response times and enhancing your application's performance.

## Getting Started:

To use MongoStreamSight, ensure you have a MongoDB replica set configured. The following environment variables must be set for the server to operate:

- `MONGO_URI`: The MongoDB connection URI (required).
- `PORT`: The port on which the MongoStreamSight server listens (optional).

### Example `find` Method Usage:

```json
{
    "method": "find",
    "params": {
        "db": "mydb",
        "collection": "users",
        "query": {"age": {"$gt": 18}},
        "projection": {"name": 1, "age": 1},
        "sort": {"age": 1}
    }
}
```

## Monitoring and Status:

Accessing the `/status` endpoint provides a JSON response containing information about the active caches and memory usage. This feature allows for easy monitoring and management of your caching system.

## Starting the Docker Image

Before you begin, ensure you have Docker installed and running on your machine. To start the MongoStreamSight Docker image with the necessary environment variables set, use the following command in your terminal:

```sh
docker run -d --name mongostreamsight -e MONGO_URI='mongodb://user:password@server1/admin?replicaSet=rs0' -e PORT=8080 -p 8080:8080 ktekosi/mongo-stream-sight
```

Set MONGO_URI to your actual MongoDB connection URI. Adjust the `PORT` value as needed or omit it to use the default port (8000).

### Making a Query with curl

To query your MongoDB database through MongoStreamSight, you can use the `curl` command to send a JSON-RPC request. The following example demonstrates how to query for users over the age of 18:

```sh
curl -X POST http://localhost:8080/ -H "Content-Type: application/json" -d '{
    "method": "find",
    "params": {
        "db": "mydb",
        "collection": "users",
        "query": {"age": {"$gt": 18}},
        "projection": {"name": 1, "age": 1},
        "sort": {"age": 1}
    }
}'
```

Ensure you replace `http://localhost:8080/` with your server's URL and port if you've configured a custom port.

### Checking the Status with curl

To monitor the active caches and check the memory usage, use the `curl` command to access the `/status` endpoint:

```sh
curl http://localhost:8080/status
```

This command will return a JSON response detailing the active caches and the current memory usage, helping you manage and optimize your caching strategy.

By following these steps, you'll be able to seamlessly integrate MongoStreamSight into your workflow, taking advantage of real-time caching and efficient data retrieval to enhance the performance and responsiveness of your MongoDB-powered applications.
