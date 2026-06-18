# 1. Build Stage
FROM node:20-alpine AS builder

# Add necessary build tools (useful for native deps, e.g. three-mesh-bvh or bvh-csg if they need it)
RUN apk add --no-cache libc6-compat python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies)
# Using npm install because ci sometimes fails if package-lock.json is out of sync in dev environments
RUN npm install

# Copy the rest of the source code
COPY . .

# Build the application (client-side Vite + server-side esbuild)
RUN npm run build

# 2. Production Stage
FROM node:20-alpine AS runner

# Add curl for the docker-compose healthcheck
RUN apk add --no-cache curl

WORKDIR /app

# Set environment to production
ENV NODE_ENV=production
ENV PORT=3000

# Copy package files
COPY package*.json ./

# Install ONLY production dependencies
RUN npm install --omit=dev

# Copy generated assets and compiled server from builder
COPY --from=builder /app/dist ./dist

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressjs
USER expressjs

# Expose port 3000
EXPOSE 3000

# Start the application directly using node for better process signals handling
CMD ["node", "dist/server.cjs"]
