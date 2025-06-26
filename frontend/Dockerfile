# Dockerfile.frontend

# Stage 1: Builder
# This stage installs dependencies and builds the Next.js application.
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the frontend source code
COPY . .

# Build the application
# This will use the `output: 'standalone'' feature in next.config.ts
RUN npm run build

# Stage 2: Runner
# This stage creates the final, lightweight production image.
FROM node:20-alpine AS runner

# Set working directory
WORKDIR /app

# Set environment to production
ENV NODE_ENV=production
# Disable telemetry
ENV NEXT_TELEMETRY_DISABLED 1

# Copy the standalone output from the builder stage.
# This includes the Next.js server and all necessary node_modules.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Expose the port Next.js runs on
EXPOSE 3000

# The standalone output creates a server.js file to run the application.
CMD ["node", "server.js"]
