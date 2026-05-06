#!/bin/sh

# Ensure data directory exists and is writable
mkdir -p /app/data
chown -R node:node /app/data

# Drop privileges and run the app as 'node' user
exec su-exec node node server.js
