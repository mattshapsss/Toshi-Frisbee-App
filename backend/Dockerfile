FROM node:18-alpine

# Install OpenSSL
RUN apk add --no-cache openssl openssl-dev libc6-compat

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies
RUN npm ci

# Generate Prisma client with correct binary
ENV PRISMA_BINARY_TARGET=linux-musl-openssl-3.0.x
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 5000

# Start server
CMD ["npm", "run", "start"]