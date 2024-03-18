#!/bin/bash

# Get the full path of the current script
current_dir="$(dirname "$(readlink -f "$0")")"

# Get the basename of the parent directory, this will be the project name of docker-compose
project_name="$(basename "$(dirname "$current_dir")")"

# Generate the key file secret and put it in a volume
docker run --rm -v "$project_name"_mongodb_keyfile:/etc/mongo/key mongo:6 bash -c "openssl rand -base64 741 > /etc/mongo/key/secret && chmod 600 /etc/mongo/key/secret && chown mongodb:mongodb /etc/mongo/key/secret"

# Start the mongo containers
docker-compose up -d
SLEEP=10
echo "Waiting ${SLEEP}s for cluster to come up..."
sleep $SLEEP

echo "Done. Trying to init replica set"

# Run the init replica
docker run -it --network ${project_name}_mongo-cluster -v ./init-replica.js:/data/init-replica.js mongo:6 mongosh mongodb://root:password@mongo1/admin /data/init-replica.js
