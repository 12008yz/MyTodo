import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Agent, fetch as undiciFetch, type Dispatcher, type RequestInit as UndiciRequestInit } from "undici";

const DEFAULT_CA_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../certs/russian_trusted_root_ca.cer",
);

let dispatcher: Dispatcher | undefined | null = null;

function resolveCaPath(): string {
  const fromEnv = process.env.GIGACHAT_CA_CERT?.trim();
  if (fromEnv) {
    return resolve(fromEnv);
  }
  return DEFAULT_CA_PATH;
}

export function getGigaChatDispatcher(): Dispatcher | undefined {
  if (dispatcher !== null) {
    return dispatcher ?? undefined;
  }

  const caPath = resolveCaPath();
  if (!existsSync(caPath)) {
    dispatcher = undefined;
    return undefined;
  }

  dispatcher = new Agent({ connect: { ca: readFileSync(caPath) } });
  return dispatcher;
}

export async function gigaChatFetch(
  url: string,
  init: UndiciRequestInit,
): Promise<Awaited<ReturnType<typeof undiciFetch>>> {
  const customDispatcher = getGigaChatDispatcher();
  if (!customDispatcher) {
    return undiciFetch(url, init);
  }

  return undiciFetch(url, { ...init, dispatcher: customDispatcher });
}
