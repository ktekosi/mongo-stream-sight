#!/bin/bash

# Print the table header
echo -e "CONTAINER ID\tIMAGE\tCREATED\tSTATUS\tPORTS\tNAME\tIP ADDRESS"

# Get a list of all running container IDs
container_ids=$(docker ps -q)

# Loop through each container ID
for container_id in $container_ids
do
  # Get the IP address of the container
  ip_address=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $container_id)
  
  # Get container details using docker ps with formatting
  container_details=$(docker ps --format "{{.ID}}\t{{.Image}}\t{{.CreatedAt}}\t{{.Status}}\t{{.Ports}}\t{{.Names}}" -f "id=$container_id")
  
  # Print the container details along with the IP address
  echo -e "$container_details\t$ip_address"
done
