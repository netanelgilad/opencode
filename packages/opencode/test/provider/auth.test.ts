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

// --- Provider loading via stored API key auth ---

test("provider loaded from stored api key auth", async () => {
  await using tmp = await tmpdir()
  const authPath = path.join(Global.Path.data, "auth.json")
  let prev: string | undefined
  try {
    prev = await Filesystem.readText(authPath)
  } catch {}
  try {
    await Filesystem.write(
      authPath,
      JSON.stringify({
        anthropic: { type: "api", key: "sk-test" },
      }),
    )
    const providers = await Instance.provide({
      directory: tmp.path,
      fn: () => Provider.list(),
    })
    expect(providers[ProviderID.anthropic]).toBeDefined()
  } finally {
    if (prev !== undefined) {
      await Filesystem.write(authPath, prev)
    } else {
      await unlink(authPath).catch(() => undefined)
    }
  }
})

test("provider source is api when loaded from stored key", async () => {
  await using tmp = await tmpdir()
  const authPath = path.join(Global.Path.data, "auth.json")
  let prev: string | undefined
  try {
    prev = await Filesystem.readText(authPath)
  } catch {}
  try {
    await Filesystem.write(
      authPath,
      JSON.stringify({
        anthropic: { type: "api", key: "sk-test" },
      }),
    )
    const providers = await Instance.provide({
      directory: tmp.path,
      fn: () => Provider.list(),
    })
    expect(providers[ProviderID.anthropic]?.source).toBe("api")
  } finally {
    if (prev !== undefined) {
      await Filesystem.write(authPath, prev)
    } else {
      await unlink(authPath).catch(() => undefined)
    }
  }
})

test("api key from auth storage is set on provider", async () => {
  await using tmp = await tmpdir()
  const authPath = path.join(Global.Path.data, "auth.json")
  let prev: string | undefined
  try {
    prev = await Filesystem.readText(authPath)
  } catch {}
  try {
    await Filesystem.write(
      authPath,
      JSON.stringify({
        anthropic: { type: "api", key: "sk-stored-key" },
      }),
    )
    const providers = await Instance.provide({
      directory: tmp.path,
      fn: () => Provider.list(),
    })
    expect(providers[ProviderID.anthropic]?.key).toBe("sk-stored-key")
  } finally {
    if (prev !== undefined) {
      await Filesystem.write(authPath, prev)
    } else {
      await unlink(authPath).catch(() => undefined)
    }
  }
})

// --- ProviderAuth.methods: built-in provider auth method types ---

test("ProviderAuth.methods returns methods for github-copilot", async () => {
  await using tmp = await tmpdir()
  const methods = await Instance.provide({
    directory: tmp.path,
    fn: () => ProviderAuth.methods(),
  })
  const copilot = methods[ProviderID.make("github-copilot")]
  expect(copilot).toBeDefined()
  expect(copilot.length).toBeGreaterThan(0)
  expect(copilot[0].type).toBe("oauth")
  expect(copilot[0].label).toBe("Login with GitHub Copilot")
})

test("ProviderAuth.methods github-copilot oauth has deployment type prompt", async () => {
  await using tmp = await tmpdir()
  const methods = await Instance.provide({
    directory: tmp.path,
    fn: () => ProviderAuth.methods(),
  })
  const copilot = methods[ProviderID.make("github-copilot")]
  const oauth = copilot.find((m) => m.type === "oauth")
  expect(oauth).toBeDefined()
  expect(oauth?.prompts).toBeDefined()
  const deploymentPrompt = oauth?.prompts?.find((p) => p.key === "deploymentType")
  expect(deploymentPrompt).toBeDefined()
  expect(deploymentPrompt?.type).toBe("select")
})

test("ProviderAuth.methods returns methods for openai with both oauth and api types", async () => {
  await using tmp = await tmpdir()
  const methods = await Instance.provide({
    directory: tmp.path,
    fn: () => ProviderAuth.methods(),
  })
  const openai = methods[ProviderID.make("openai")]
  expect(openai).toBeDefined()
  expect(openai.length).toBeGreaterThan(1)
  const types = openai.map((m) => m.type)
  expect(types).toContain("oauth")
  expect(types).toContain("api")
})

test("ProviderAuth.methods returns api method for cloudflare-workers-ai", async () => {
  await using tmp = await tmpdir()
  const methods = await Instance.provide({
    directory: tmp.path,
    fn: () => ProviderAuth.methods(),
  })
  const workers = methods[ProviderID.make("cloudflare-workers-ai")]
  expect(workers).toBeDefined()
  expect(workers.length).toBeGreaterThan(0)
  expect(workers[0].type).toBe("api")
})

test("ProviderAuth.methods returns api method for cloudflare-ai-gateway", async () => {
  await using tmp = await tmpdir()
  const methods = await Instance.provide({
    directory: tmp.path,
    fn: () => ProviderAuth.methods(),
  })
  const gateway = methods[ProviderID.make("cloudflare-ai-gateway")]
  expect(gateway).toBeDefined()
  expect(gateway.length).toBeGreaterThan(0)
  expect(gateway[0].type).toBe("api")
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
