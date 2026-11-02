# Nemotron tier benchmark (Nano vs Super vs Ultra)

Five hidden-test coding tasks (`tasks.ts`). Each model writes `src/solution.js`,
tests run in the sandbox, and the model gets one repair attempt from the test output.
Records pass@1, pass after repair, latency and cost (public Token Factory prices).

## Run locally

```bash
cd console
export NEBIUS_API_KEY=...
npm run bench                  # all tiers
BENCH_TIERS=nano,super npm run bench
```

## Run as a Nebius Serverless Job

```bash
cd console
docker build -f bench/Dockerfile -t <registry>/codingagent-bench:latest .
docker push <registry>/codingagent-bench:latest
# Then create a job (Nebius console → Serverless → Jobs, or the `nebius` CLI) with:
#   image: <registry>/codingagent-bench:latest
#   env:   NEBIUS_API_KEY=<secret>, BENCH_TIERS=nano,super,ultra
#   CPU-only preset is enough (inference happens on Token Factory)
# Results print to the job logs as a markdown table and are written to /out.
```

Check the current `nebius` CLI syntax for jobs in the Nebius docs before running.
Results go into the main README's benchmark table. Do not edit numbers by hand.
