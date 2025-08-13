FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies including serve
RUN npm ci

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Expose port (Railway will override this)
EXPOSE 3000

# Start with serve using Railway's PORT
CMD ["sh", "-c", "npx serve -s dist -l $PORT"]