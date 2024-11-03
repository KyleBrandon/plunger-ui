# Stage 1: use node.js image
FROM node:18-alpine AS builder

# Set the working directory inside the container
WORKDIR /app

# Copy the package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the source code into the container
COPY . .

# Compile typescript
RUN npm run build

# Stage 2: Typescript image
FROM node:18-alpine

# set working directory
WORKDIR /app

# Copy needed output from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/src/views ./dist/views
COPY --from=builder /app/package*.json ./

# Install
RUN npm install

# Expose the port for the web server
EXPOSE ${PLUNGE_UI_PORT}

# Start the app
CMD ["node", "dist/index.js", "--port ${PLUNGE_UI_PORT}", "--plungeServerIP ${PLUNGE_SERVER_IP}", "--plungeServerPort ${PLUNGE_SERVER_PORT}"]

