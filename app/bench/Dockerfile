# Image for running the Nemotron tier benchmark as a Nebius Serverless Job.
FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY tsconfig.json ./
COPY src/lib/agent ./src/lib/agent
COPY src/lib/utils.ts ./src/lib/utils.ts
COPY bench ./bench
ENV SANDBOX_RUNNER=local BENCH_OUT_DIR=/out
RUN mkdir -p /out && chown node:node /out
# Run as the image's built-in unprivileged "node" user, not root.
USER node
CMD ["node", "--import", "tsx", "bench/nemotron-bench.ts"]
