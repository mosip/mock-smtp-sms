FROM node:20-alpine

ARG SOURCE
ARG COMMIT_HASH
ARG COMMIT_ID
ARG BUILD_TIME
LABEL source=${SOURCE}
LABEL commit_hash=${COMMIT_HASH}
LABEL commit_id=${COMMIT_ID}
LABEL build_time=${BUILD_TIME}

WORKDIR /usr/src/app

ENV SERVER_HOST=0.0.0.0

# Copy manifests first so dependency layer is cached independently of source changes
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY app.js index.html ./

# Drop root privileges
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 8080
EXPOSE 8081
EXPOSE 8025

CMD ["node", "app.js"]
