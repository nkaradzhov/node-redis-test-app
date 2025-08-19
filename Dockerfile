# Build stage
FROM node:24-alpine AS builder

# Install git
RUN apk add --no-cache git

# Environment variables for repository cloning
ARG REPO_URL=https://github.com/nkaradzhov/node-redis.git
ARG REPO_BRANCH=hitless-upgrades
ARG REPO_COMMIT
ENV REPO_URL=${REPO_URL}
ENV REPO_BRANCH=${REPO_BRANCH}
ENV REPO_COMMIT=${REPO_COMMIT}

# Set working directory
WORKDIR /app

# Clone the repository locally if REPO_URL is provided
RUN if [ -n "$REPO_URL" ]; then \
        git clone --branch "$REPO_BRANCH" --single-branch "$REPO_URL" node-redis && \
        cd node-redis && \
        if [ -n "$REPO_COMMIT" ]; then git checkout "$REPO_COMMIT"; fi && \
        npm ci --include=dev && \
        NODE_OPTIONS="--max-old-space-size=4096" npm run build; \
    fi

# Copy package files (fallback if no repo cloned)
COPY package*.json ./

# Install all dependencies (including devDependencies for building)
RUN npm install

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

# Copy built node-redis from builder stage if it exists
COPY --from=builder /app/node-redis ./node-redis

# Install only production dependencies
RUN npm ci --only=production

# Copy built application from builder stage
COPY --from=builder /app/build ./build

# Switch to non-root user
USER node

ENV NODE_ENV=production

# Start the application using PM2
CMD ["node", "build/main.js"]
