// Runs once at server start; Node-only work lives in instrumentation-node.ts (keeps Edge bundle clean).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") await import("./instrumentation-node");
}
