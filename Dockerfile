FROM node:20-slim

WORKDIR /app

# Install build dependencies for native modules (better-sqlite3, robotjs)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package files first for layer caching
COPY package.json ./
RUN npm install --production --ignore-optional

# Copy source
COPY . .

# Build dashboard
RUN cd src/desktop/dashboard-ui && npm install && npm run build

# Build studio
RUN cd src/studio && npm install && npm run build

# Cloud mode defaults
ENV OPENACE_CLOUD=true
ENV PORT=3333
ENV NODE_ENV=production

EXPOSE 3333

CMD ["node", "scripts/start-dashboard.js"]
