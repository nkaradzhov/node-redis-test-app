# Build stage
FROM node:24-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for building)
RUN npm ci --include=dev

# Copy source code and configuration files
COPY src/ ./src/
COPY tsconfig.json ./

# Build the TypeScript application
RUN npm run build

# Production stage
FROM node:24-alpine AS production

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built application from builder stage
COPY --from=builder /app/build ./build

# Switch to non-root user
USER node

ENV NODE_ENV=production

# Start the application using PM2
CMD ["node" ,"build/main.js"]
