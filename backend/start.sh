#!/bin/bash

# Check if DATABASE_URL contains 'postgresql' to determine if we need migrations
if [[ "$DATABASE_URL" == *"postgresql"* ]]; then
  echo "PostgreSQL detected, running migrations..."
  npx prisma migrate deploy
else
  echo "SQLite detected, skipping migrations..."
  # For SQLite, just ensure the database file exists
  npx prisma db push --skip-seed
fi

# Start the server
npm run start