import { afterEach, test, expect } from "bun:test"
import path from "path"
import { unlink } from "fs/promises"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { Provider } from "../../src/provider/provider"
import { ProviderAuth } from "../../src/provider/auth"
import { ProviderID } from "../../src/provider/schema"
import { Global } from "../../src/global"
import { Filesystem } from "../../src/util/filesystem"

afterEach(async () => {
  await Instance.disposeAll()
})

async function auth(data: Record<string, object>, fn: () => Promise<void>) {
  const p = path.join(Global.Path.data, "auth.json")
  let saved: string | undefined
  try {
    saved = await Filesystem.readText(p)
  } catch {}
  try {
    await Filesystem.write(p, JSON.stringify(data))
    await fn()
  } finally {
    if (saved !== undefined) {
      await Filesystem.write(p, saved)
    } else {
      await unlink(p).catch(() => undefined)
    }
  }
}

// --- Provider loading via stored API key auth ---

test("provider loaded from stored api key auth", async () => {
  await using tmp = await tmpdir()
  await auth({ anthropic: { type: "api", key: "sk-test" } }, async () => {
    const providers = await Instance.provide({
      directory: tmp.path,
      fn: () => Provider.list(),
    })
    expect(providers[ProviderID.anthropic]).toBeDefined()
  })
})

test("provider source is api when loaded from stored key", async () => {
  await using tmp = await tmpdir()
  await auth({ anthropic: { type: "api", key: "sk-test" } }, async () => {
    const providers = await Instance.provide({
      directory: tmp.path,
      fn: () => Provider.list(),
    })
    expect(providers[ProviderID.anthropic]?.source).toBe("api")
  })
})

test("api key from auth storage is set on provider", async () => {
  await using tmp = await tmpdir()
  await auth({ anthropic: { type: "api", key: "sk-stored-key" } }, async () => {
    const providers = await Instance.provide({
      directory: tmp.path,
      fn: () => Provider.list(),
    })
    expect(providers[ProviderID.anthropic]?.key).toBe("sk-stored-key")
  })
})

// --- ProviderAuth.methods: built-in provider auth method types ---

test("ProviderAuth.methods returns methods for github-copilot", async () => {
  await using tmp = await tmpdir()
  const all = await Instance.provide({
    directory: tmp.path,
    fn: () => ProviderAuth.methods(),
  })
  const found = all[ProviderID.make("github-copilot")]
  expect(found).toBeDefined()
  expect(found.length).toBeGreaterThan(0)
  expect(found[0].type).toBe("oauth")
  expect(found[0].label).toBe("Login with GitHub Copilot")
})

test("ProviderAuth.methods github-copilot oauth has deployment type prompt", async () => {
  await using tmp = await tmpdir()
  const all = await Instance.provide({
    directory: tmp.path,
    fn: () => ProviderAuth.methods(),
  })
  const found = all[ProviderID.make("github-copilot")]
  const method = found.find((m) => m.type === "oauth")
  expect(method).toBeDefined()
  expect(method?.prompts).toBeDefined()
  const field = method?.prompts?.find((p) => p.key === "deploymentType")
  expect(field).toBeDefined()
  expect(field?.type).toBe("select")
})

test("ProviderAuth.methods returns methods for openai with both oauth and api types", async () => {
  await using tmp = await tmpdir()
  const all = await Instance.provide({
    directory: tmp.path,
    fn: () => ProviderAuth.methods(),
  })
  const found = all[ProviderID.make("openai")]
  expect(found).toBeDefined()
  expect(found.length).toBeGreaterThan(1)
  expect(found.map((m) => m.type)).toContain("oauth")
  expect(found.map((m) => m.type)).toContain("api")
})

test("ProviderAuth.methods returns api method for cloudflare-workers-ai", async () => {
  await using tmp = await tmpdir()
  const all = await Instance.provide({
    directory: tmp.path,
    fn: () => ProviderAuth.methods(),
  })
  const found = all[ProviderID.make("cloudflare-workers-ai")]
  expect(found).toBeDefined()
  expect(found.length).toBeGreaterThan(0)
  expect(found[0].type).toBe("api")
})

test("ProviderAuth.methods returns api method for cloudflare-ai-gateway", async () => {
  await using tmp = await tmpdir()
  const all = await Instance.provide({
    directory: tmp.path,
    fn: () => ProviderAuth.methods(),
  })
  const found = all[ProviderID.make("cloudflare-ai-gateway")]
  expect(found).toBeDefined()
  expect(found.length).toBeGreaterThan(0)
  expect(found[0].type).toBe("api")
})

// --- ProviderAuth.callback error cases ---

test("ProviderAuth.callback fails when no prior authorize called", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      await expect(
        ProviderAuth.callback({
          providerID: ProviderID.make("github-copilot"),
          method: 0,
        }),
      ).rejects.toThrow()
    },
  })
})

test("ProviderAuth.authorize returns undefined for api key methods", async () => {
  await using tmp = await tmpdir()
  const result = await Instance.provide({
    directory: tmp.path,
    fn: () =>
      ProviderAuth.authorize({
        providerID: ProviderID.make("cloudflare-workers-ai"),
        method: 0,
      }),
  })
  expect(result).toBeUndefined()
})
