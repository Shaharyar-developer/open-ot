import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";

export interface SnapshotAdapter {
  saveSnapshot(
    docId: string,
    revision: number,
    snapshot: unknown
  ): Promise<void>;
  loadSnapshot(docId: string, revision: number): Promise<unknown | null>;
  getLatestSnapshotRevision(docId: string): Promise<number | null>;
}

export class S3SnapshotAdapter implements SnapshotAdapter {
  private s3: S3Client;
  private bucket: string;

  constructor(bucket: string, region: string) {
    this.s3 = new S3Client({ region });
    this.bucket = bucket;
  }

  async saveSnapshot(
    docId: string,
    revision: number,
    snapshot: unknown
  ): Promise<void> {
    const key = `snapshots/${docId}/${revision}.json`;
    const body = JSON.stringify(snapshot);

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: "application/json",
      })
    );

    // Also update a "latest" pointer?
    // Or we just rely on listing?
    // S3 listing is slow.
    // Usually we store the latest revision number in a separate metadata file or database (like Redis).
    // But if we want to be purely S3 based for snapshots:
    // We can overwrite `snapshots/${docId}/latest.json` with { revision, snapshot }?
    // Or just { revision }.

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: `snapshots/${docId}/latest.json`,
        Body: JSON.stringify({ revision }),
        ContentType: "application/json",
      })
    );
  }

  async loadSnapshot(docId: string, revision: number): Promise<unknown | null> {
    const key = `snapshots/${docId}/${revision}.json`;

    try {
      const response = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );

      if (!response.Body) return null;

      const str = await response.Body.transformToString();
      return JSON.parse(str);
    } catch (e: unknown) {
      if (
        e &&
        typeof e === "object" &&
        "name" in e &&
        (e as { name: string }).name === "NoSuchKey"
      )
        return null;
      throw e;
    }
  }

  async getLatestSnapshotRevision(docId: string): Promise<number | null> {
    const key = `snapshots/${docId}/latest.json`;

    try {
      const response = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        })
      );

      if (!response.Body) return null;

      const str = await response.Body.transformToString();
      const data = JSON.parse(str);
      return data.revision;
    } catch (e: unknown) {
      if (
        e &&
        typeof e === "object" &&
        "name" in e &&
        (e as { name: string }).name === "NoSuchKey"
      )
        return null;
      throw e;
    }
  }
}
