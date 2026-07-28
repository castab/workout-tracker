import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
const AUTH_CACHE = "workout-tracker-pwa-v3-auth-pages";

function response(body, overrides = {}) {
  const value = {
    body,
    ok: true,
    status: 200,
    redirected: false,
    type: "basic",
    url: "https://tracker.test/workouts/one",
    ...overrides,
  };
  value.clone = () => response(value.body, value);
  return value;
}

function request(path) {
  return { method: "GET", mode: "navigate", url: `https://tracker.test${path}` };
}

function harness(fetchImpl) {
  const listeners = new Map();
  const stores = new Map();

  function store(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name);
  }

  const caches = {
    async open(name) {
      const entries = store(name);
      return {
        addAll: async () => {},
        delete: async (key) => entries.delete(typeof key === "string" ? key : key.url),
        match: async (key) => entries.get(typeof key === "string" ? key : key.url),
        put: async (key, value) => entries.set(typeof key === "string" ? key : key.url, value),
      };
    },
    async delete(name) { return stores.delete(name); },
    async keys() { return [...stores.keys()]; },
    async match(key) {
      const cacheKey = typeof key === "string" ? key : key.url;
      for (const entries of stores.values()) {
        if (entries.has(cacheKey)) return entries.get(cacheKey);
      }
    },
  };

  const self = {
    location: { origin: "https://tracker.test" },
    clients: { claim() {} },
    skipWaiting() {},
    addEventListener(type, listener) { listeners.set(type, listener); },
  };

  vm.runInNewContext(source, { caches, fetch: fetchImpl, self, URL });

  async function navigate(path) {
    const waits = [];
    let responsePromise;
    listeners.get("fetch")({
      request: request(path),
      respondWith(value) { responsePromise = Promise.resolve(value); },
      waitUntil(value) { waits.push(Promise.resolve(value)); },
    });
    return { result: await responsePromise, waits };
  }

  async function message(data) {
    const waits = [];
    listeners.get("message")({ data, waitUntil(value) { waits.push(value); } });
    await Promise.all(waits);
  }

  return { caches, message, navigate, store };
}

test("cached workout cold launch returns before a delayed refresh", async () => {
  let release;
  const delayed = new Promise((resolve) => { release = resolve; });
  const app = harness(() => delayed);
  app.store(AUTH_CACHE).set(request("/workouts/one").url, response("cached"));

  const launch = app.navigate("/workouts/one");
  const winner = await Promise.race([launch.then(({ result }) => result.body), new Promise((resolve) => setTimeout(() => resolve("timeout"), 20))]);
  assert.equal(winner, "cached");

  release(response("fresh"));
  const { waits } = await launch;
  await Promise.all(waits);
  assert.equal(app.store(AUTH_CACHE).get(request("/workouts/one").url).body, "fresh");
});

test("offline cold launch uses the precached offline document", async () => {
  const app = harness(async () => { throw new Error("offline"); });
  app.store("workout-tracker-pwa-v3-public").set("/offline", response("offline", { url: "https://tracker.test/offline" }));
  assert.equal((await app.navigate("/workouts/new")).result.body, "offline");
});

test("first uncached workout visit waits for and caches the network", async () => {
  const app = harness(async () => response("network"));
  assert.equal((await app.navigate("/workouts/one")).result.body, "network");
  assert.equal(app.store(AUTH_CACHE).get(request("/workouts/one").url).body, "network");
});

test("failed background refresh retains the cached workout", async () => {
  const app = harness(async () => { throw new Error("offline"); });
  app.store(AUTH_CACHE).set(request("/workouts/one").url, response("cached"));
  const { result, waits } = await app.navigate("/workouts/one");
  await Promise.all(waits);
  assert.equal(result.body, "cached");
  assert.equal(app.store(AUTH_CACHE).get(request("/workouts/one").url).body, "cached");
});

test("clear-auth-cache message removes only private navigation documents", async () => {
  const app = harness(async () => response("unused"));
  app.store(AUTH_CACHE).set(request("/workouts/one").url, response("private"));
  app.store("workout-tracker-pwa-v3-public").set("/offline", response("public"));
  await app.message({ type: "clear-auth-cache" });
  assert.equal(app.store(AUTH_CACHE).size, 0);
  assert.equal(app.store("workout-tracker-pwa-v3-public").size, 1);
});

test("session expiration clears all authenticated navigation entries", async () => {
  const login = response("login", { redirected: true, url: "https://tracker.test/login" });
  const app = harness(async () => login);
  app.store(AUTH_CACHE).set(request("/workouts/one").url, response("one"));
  app.store(AUTH_CACHE).set(request("/workouts/two").url, response("two", { url: "https://tracker.test/workouts/two" }));

  const { result, waits } = await app.navigate("/workouts/one");
  assert.equal(result.body, "one");
  await Promise.all(waits);
  assert.equal(app.store(AUTH_CACHE).size, 0);
});
