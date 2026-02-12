import { BlobServiceClient } from "@azure/storage-blob";
import type { Readable } from "stream";

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.AZURE_STORAGE_CONTAINER || "photomagic";

function getContainerClient() {
  if (!connectionString) {
    throw new Error("AZURE_STORAGE_CONNECTION_STRING is not configured");
  }
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  return blobServiceClient.getContainerClient(containerName);
}

/** Blob path: originals/{listingId}/{photoId}.{ext} */
export function blobPathOriginal(listingId: string, photoId: string, ext: string): string {
  return `originals/${listingId}/${photoId}.${ext}`;
}

/** Blob path: thumbs/{listingId}/{photoId}_thumb.jpg */
export function blobPathThumb(listingId: string, photoId: string): string {
  return `thumbs/${listingId}/${photoId}_thumb.jpg`;
}

export async function uploadOriginal(
  listingId: string,
  photoId: string,
  ext: string,
  buffer: Buffer
): Promise<void> {
  const container = getContainerClient();
  const path = blobPathOriginal(listingId, photoId, ext);
  const blockBlobClient = container.getBlockBlobClient(path);
  await blockBlobClient.uploadData(buffer);
}

export async function uploadThumbnail(
  listingId: string,
  photoId: string,
  buffer: Buffer
): Promise<void> {
  const container = getContainerClient();
  const path = blobPathThumb(listingId, photoId);
  const blockBlobClient = container.getBlockBlobClient(path);
  await blockBlobClient.uploadData(buffer);
}

export async function downloadToBuffer(blobPath: string): Promise<Buffer> {
  const container = getContainerClient();
  const blockBlobClient = container.getBlockBlobClient(blobPath);
  const downloadResponse = await blockBlobClient.download();
  if (!downloadResponse.readableStreamBody) {
    throw new Error(`Blob not found: ${blobPath}`);
  }
  return streamToBuffer(downloadResponse.readableStreamBody);
}

/** Returns a Node.js Readable stream for piping to archiver etc. */
export async function downloadStream(blobPath: string): Promise<Readable> {
  const container = getContainerClient();
  const blockBlobClient = container.getBlockBlobClient(blobPath);
  const downloadResponse = await blockBlobClient.download();
  if (!downloadResponse.readableStreamBody) {
    throw new Error(`Blob not found: ${blobPath}`);
  }
  return downloadResponse.readableStreamBody as Readable;
}

export async function deleteBlob(blobPath: string): Promise<void> {
  const container = getContainerClient();
  const blockBlobClient = container.getBlockBlobClient(blobPath);
  await blockBlobClient.deleteIfExists();
}

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}
