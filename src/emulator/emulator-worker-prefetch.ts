import {
    type EmulatorChunkedFileSpec,
    generateChunkUrl,
    generateNextChunkIndex
} from "./emulator-common";

const DISK_CACHE_NAME = "disk-cache";
const diskCacheSpecs: EmulatorChunkedFileSpec[] = [];

function listener(event: MessageEvent) {
    const {data} = event;
    if (data.type === "port") {
        const port = data.port as MessagePort;
        port.onmessage = listener;
    } else if (data.type === "prefetch") {
        const diskFileSpec = data.spec as EmulatorChunkedFileSpec;
        diskCacheSpecs.push(diskFileSpec);
        (async function () {
            const cache = await caches.open(DISK_CACHE_NAME);
            fetchChunks(diskFileSpec, cache, diskFileSpec.prefetchChunks);
        })()
    } else if (data.type === "load") {
        (async function () {
            const chunkUrl = data.chunkUrl as string;
            const lock = new Int32Array(data.lock as SharedArrayBuffer);
            const response = data.response as SharedArrayBuffer;
            const cache = await caches.open(DISK_CACHE_NAME);
            prefetchNextChunk(cache, chunkUrl);
            const cached = await cache.match(new Request(chunkUrl))
                .then(response => response?.arrayBuffer());
            if (cached) {
                new Uint8Array(response).set(new Uint8Array(cached));
                Atomics.store(lock, 0, 1);
            } else {
                Atomics.store(lock, 0, 2);
            }
            Atomics.notify(lock, 0);
        })()
    } else if (data.type === "store") {
        (async function () {
            const chunkUrl = data.chunkUrl as string;
            const chunk = data.chunk as Uint8Array;
            const cache = await caches.open(DISK_CACHE_NAME);
            cache.put(new Request(chunkUrl), new Response(chunk));
        })()
    }
}

async function fetchChunks(spec: EmulatorChunkedFileSpec, cache: Cache, chunkIndexes: number[]) {
    const urls = [];
    for (const chunkIndex of chunkIndexes) {
        if (chunkIndex > spec.chunks.length) {
            continue;
        }

        const chunkSignature = spec.chunks[chunkIndex];
        if (!chunkSignature) {
            // Zero-ed out chunk, skip it.
            continue;
        }
        const chunkUrl = generateChunkUrl(spec, chunkIndex);
        const cached = await cache.match(new Request(chunkUrl));
        if (!cached) {
            urls.push(chunkUrl);
        }
    }
    if (!urls.length) {
        return []
    }
    await Promise.all(urls.map(url => cache.add(url)));
    await fetchChunks(spec, cache, chunkIndexes.map(index => index + 1));
}

async function prefetchNextChunk(cache: Cache, url: string) {
    const result = generateNextChunkIndex(url, diskCacheSpecs);
    if (!result) {
        return;
    }
    const [spec, index] = result;
    fetchChunks(spec, cache, [index]);
}

addEventListener("message", listener);
