# Mongo Stream Sight

Mongo Stream Sight is a cutting-edge application designed to provide real-time caching for MongoDB databases. Utilizing Bun as its runtime, this application offers a JSON-RPC service specifically for the MongoDB `find` method, ensuring efficient data retrieval and management.

## Features

- **Real-Time Caching**: Caches the entire contents of a query in memory for instant access.
- **Efficient Data Retrieval**: Utilizes JSON-RPC service for handling `find` method queries.
- **MongoDB Replica Set Integration**: Requires a MongoDB replica set to subscribe to change streams.
- **Intelligent Query Handling**: On the initial request of a specific query, Mongo Stream Sight performs the full MongoDB query. It then subscribes to the change stream to update the cache. For subsequent requests of the same query, the data is delivered directly from the cache, significantly enhancing performance.

## Getting Started

### Prerequisites

- MongoDB Replica Set
- Bun Runtime Environment

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ktekosi/mongo-stream-sight.git
   ```
2. Navigate to the project directory:
   ```bash
   cd mongo-stream-sight
   ```
3. Install dependencies:
   ```bash
   bun install
   ```

## Testing

Mongo Stream Sight includes a suite of tests to validate its functionality. To properly run these tests, a local MongoDB cluster is required along with DNS resolution for container names.

### Setting Up Local MongoDB Cluster for Testing
1. **Prerequisites**:
   - Ensure Docker is installed and running on your system along with docker-compose.
   - The local environment should resolve container names to their IPs. Use the `defreitas/dns-proxy-server` container for this purpose.

2. **Start DNS Proxy Server**:
   - Pull and run the `defreitas/dns-proxy-server` container:
     ```bash
     docker pull defreitas/dns-proxy-server
     docker run -d --hostname dns.mageddo --name dns-proxy-server -p 5380:5380 -v /var/run/docker.sock:/var/run/docker.sock -v /etc/resolv.conf:/etc/resolv.conf --restart unless-stopped defreitas/dns-proxy-server
     ```

3. **Setup MongoDB Cluster**:
   - Navigate to the `setup` directory:
     ```bash
     cd mongos-tream-sight/setup
     ```
   - Execute the `setup.sh` script to create a local MongoDB cluster using `docker-compose`:
     ```bash
     ./setup.sh
     ```
   - This will deploy 3 MongoDB containers configured as a replica set.

### Running Tests
- After setting up the MongoDB cluster, return to the project root directory:
  ```bash
  cd ..
  ```
- Execute the tests using Bun:
  ```bash
  bun test
  ```
- The test suite will run, and you should see the results indicating the status of each test.

Ensure that the DNS proxy server is running during testing to allow for proper name resolution of the containers. This setup mimics a realistic environment where services communicate through a network, ensuring that the tests accurately reflect real-world scenarios.


### Configuration

(Instructions on configuring Mongo Stream Sight, setting up environment variables, connecting to MongoDB, etc.)

## Running the Application

Running Mongo Stream Sight locally is straightforward using Bun. You need to specify the MongoDB URI and an optional port for the web server.

### Prerequisites
- Ensure Bun is installed on your system.
- Have a running MongoDB replica set accessible via the specified URI.

### Starting the Application
1. **Specify MongoDB URI**:
   - The MongoDB URI should be in the format: `mongodb://user:password@mongo1,mongo2,mongo3/?replicaSet=rs0`.
   - Replace `user`, `password`, `mongo1,mongo2,mongo3` with your MongoDB credentials and host details.

2. **Run the Application**:
   - Navigate to the root directory of the cloned repository.
   - Execute the following command:
     ```bash
     bun src/index.ts -m mongodb://user:password@mongo1,mongo2,mongo3/?replicaSet=rs0 [-p PORT]
     ```
   - Replace the MongoDB URI with your actual MongoDB connection string.
   - Optionally, specify a port for the web server using the `-p` flag. If not specified, a default port will be used (port 8000).

3. **Verify Operation**:
   - Once started, the application will connect to the specified MongoDB instance and start the web server.
   - You can now interact with the application via the provided web API.
   - You can check the status with:
   ```bash
   curl -X GET http://localhost:8000/status
   ```
   It should respond with a json of caches, like this:
   ```json
   {"caches":[]}
   ```

Make sure that the MongoDB instance is accessible from your local environment, and the URI is correctly formatted. The application will log any connection issues or errors during startup, which can be helpful for troubleshooting.


## Usage

Mongo Stream Sight offers a JSON-RPC service to interact with MongoDB. You can perform various operations such as querying data using a POST request. Below is an example of using the service to find documents in a MongoDB collection.

### Example: Finding Documents in a Collection

This example demonstrates how to send a POST request to Mongo Stream Sight to find documents in the 'users' collection of a specified database.

1. **Prepare the Request Data**:
   - The request should be structured as a JSON object with the method and parameters for the MongoDB operation.
   - For a `find` operation, specify the database name, collection name, query, projection, and sort parameters.
   - Here is an example request body:
     ```json
     {
         "method": "find",
         "params": {
             "db": "yourDatabaseName",
             "collection": "users",
             "query": {"age": {"$gt": 18}},
             "projection": {"name": 1, "age": 1},
             "sort": {"age": 1}
         }
     }
     ```

2. **Send the POST Request**:
   - Use `curl` or any other HTTP client to send the request to the application.
   - Assuming the application is running on `localhost` and listening on port 8000, the `curl` command would be:
     ```bash
     curl -X POST http://localhost:8000 -H "Content-Type: application/json" -d '{"method": "find", "params": {"db": "yourDatabaseName", "collection": "users", "query": {"age": {"$gt": 18}}, "projection": {"name": 1, "age": 1}, "sort": {"age": 1}}}'
     ```

3. **Check the Response**:
   - The server should respond with the requested data from the MongoDB collection.

Replace `yourDatabaseName` with the actual name of your database, and adjust the `query`, `projection`, and `sort` parameters as per your requirements.

This example shows a basic use case of querying data. Mongo Stream Sight can be used for more complex operations following a similar structure.


## Contact

Project Link: [https://github.com/ktekosi/mongo-stream-sight.git](https://github.com/ktekosi/mongo-stream-sight.git)
