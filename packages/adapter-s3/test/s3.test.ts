import { describe, it, expect, beforeEach } from "vitest";
import { S3SnapshotAdapter } from "../src/index";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import { sdkStreamMixin } from "@aws-sdk/util-stream-node";
import { Readable } from "stream";

const s3Mock = mockClient(S3Client);

describe("S3SnapshotAdapter", () => {
  let adapter: S3SnapshotAdapter;

  beforeEach(() => {
    s3Mock.reset();
    adapter = new S3SnapshotAdapter("my-bucket", "us-east-1");
  });

  it("should save snapshot", async () => {
    s3Mock.on(PutObjectCommand).resolves({});

    await adapter.saveSnapshot("doc1", 10, { foo: "bar" });

    expect(s3Mock.calls()).toHaveLength(2); // One for snapshot, one for latest

    const snapshotCall = s3Mock.call(0);
    expect(snapshotCall.args[0].input).toEqual({
      Bucket: "my-bucket",
      Key: "snapshots/doc1/10.json",
      Body: JSON.stringify({ foo: "bar" }),
      ContentType: "application/json",
    });

    const latestCall = s3Mock.call(1);
    expect(latestCall.args[0].input).toEqual({
      Bucket: "my-bucket",
      Key: "snapshots/doc1/latest.json",
      Body: JSON.stringify({ revision: 10 }),
      ContentType: "application/json",
    });
  });

  it("should load snapshot", async () => {
    const stream = new Readable();
    stream.push(JSON.stringify({ foo: "bar" }));
    stream.push(null);

    // sdkStreamMixin is needed to mock the Body properly for transformToString
    const sdkStream = sdkStreamMixin(stream);

    s3Mock.on(GetObjectCommand).resolves({
      Body: sdkStream,
    });

    const snapshot = await adapter.loadSnapshot("doc1", 10);
    expect(snapshot).toEqual({ foo: "bar" });
  });

  it("should return null if snapshot missing", async () => {
    s3Mock.on(GetObjectCommand).rejects({ name: "NoSuchKey" });

    const snapshot = await adapter.loadSnapshot("doc1", 999);
    expect(snapshot).toBeNull();
  });
});
