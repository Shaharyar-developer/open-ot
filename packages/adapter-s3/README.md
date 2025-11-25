# @open-ot/adapter-s3

AWS S3 snapshot adapter for OpenOT, providing long-term snapshot storage and retrieval.

## Overview

`@open-ot/adapter-s3` implements a snapshot storage adapter using AWS S3. It's designed to work alongside a primary backend adapter (like Redis) to periodically save document snapshots, reducing the need to replay long operation histories.

## Installation

```bash
npm install @open-ot/adapter-s3
```

## Quick Start

```typescript
import { S3SnapshotAdapter } from '@open-ot/adapter-s3';

const snapshotAdapter = new S3SnapshotAdapter(
  'my-ot-snapshots-bucket',
  'us-east-1'
);

// Save a snapshot
await snapshotAdapter.saveSnapshot('doc-1', 100, {
  content: 'Hello World',
  metadata: { author: 'Alice' }
});

// Load a snapshot
const snapshot = await snapshotAdapter.loadSnapshot('doc-1', 100);

// Get the latest snapshot revision
const latestRev = await snapshotAdapter.getLatestSnapshotRevision('doc-1');
```

## Why Use Snapshots?

As documents accumulate operations over time, replaying the entire history becomes expensive. Snapshots solve this by:

1. **Reducing replay time**: Load a recent snapshot instead of replaying thousands of operations.
2. **Enabling fast initialization**: New clients can start from a snapshot instead of revision 0.
3. **Archiving history**: Store snapshots for audit trails or rollback capabilities.

## S3 Bucket Structure

The adapter uses the following S3 key structure:

```
snapshots/
  {docId}/
    {revision}.json          # Snapshot at specific revision
    latest.json              # Pointer to latest snapshot revision
```

**Example:**

```
snapshots/
  doc-1/
    0.json                   # Initial snapshot
    100.json                 # Snapshot at revision 100
    200.json                 # Snapshot at revision 200
    latest.json              # { "revision": 200 }
```

## API Reference

### `S3SnapshotAdapter`

#### Constructor

```typescript
new S3SnapshotAdapter(bucket: string, region: string)
```

**Parameters:**
- **`bucket`**: S3 bucket name
- **`region`**: AWS region (e.g., `"us-east-1"`)

**Example:**

```typescript
const adapter = new S3SnapshotAdapter('my-snapshots', 'us-west-2');
```

#### Methods

##### `saveSnapshot(docId: string, revision: number, snapshot: unknown): Promise<void>`

Save a snapshot to S3.

**Parameters:**
- **`docId`**: Document ID
- **`revision`**: Revision number for this snapshot
- **`snapshot`**: The document state to save

**Behavior:**
- Saves the snapshot to `snapshots/{docId}/{revision}.json`
- Updates `snapshots/{docId}/latest.json` with the new revision

**Example:**

```typescript
await adapter.saveSnapshot('doc-1', 150, {
  text: 'Hello World',
  metadata: { lastModified: Date.now() }
});
```

##### `loadSnapshot(docId: string, revision: number): Promise<unknown | null>`

Load a snapshot from S3.

**Parameters:**
- **`docId`**: Document ID
- **`revision`**: Revision number to load

**Returns:**
- The snapshot object, or `null` if not found

**Example:**

```typescript
const snapshot = await adapter.loadSnapshot('doc-1', 150);
if (snapshot) {
  console.log('Loaded snapshot:', snapshot);
} else {
  console.log('Snapshot not found');
}
```

##### `getLatestSnapshotRevision(docId: string): Promise<number | null>`

Get the revision number of the latest snapshot.

**Returns:**
- The latest snapshot revision, or `null` if no snapshots exist

**Example:**

```typescript
const latestRev = await adapter.getLatestSnapshotRevision('doc-1');
if (latestRev !== null) {
  const snapshot = await adapter.loadSnapshot('doc-1', latestRev);
}
```

## Integration with Server

Combine the S3 adapter with a primary backend for optimal performance:

```typescript
import { Server } from '@open-ot/server';
import { RedisAdapter } from '@open-ot/adapter-redis';
import { S3SnapshotAdapter } from '@open-ot/adapter-s3';
import { TextType } from '@open-ot/core';

const redis = new RedisAdapter('redis://localhost:6379');
const s3 = new S3SnapshotAdapter('my-snapshots', 'us-east-1');

const server = new Server(redis);
server.registerType(TextType);

// Periodically save snapshots
setInterval(async () => {
  const docs = await getActiveDocuments(); // Your logic
  
  for (const docId of docs) {
    const record = await redis.getRecord(docId);
    
    // Save snapshot every 100 revisions
    if (record.v % 100 === 0) {
      await s3.saveSnapshot(docId, record.v, record.data);
      console.log(`Saved snapshot for ${docId} at revision ${record.v}`);
    }
  }
}, 60000); // Every minute
```

## Fast Client Initialization

Use snapshots to initialize clients faster:

```typescript
// Server-side: Get latest snapshot
const latestRev = await s3.getLatestSnapshotRevision('doc-1');
const snapshot = latestRev 
  ? await s3.loadSnapshot('doc-1', latestRev)
  : await redis.getRecord('doc-1').then(r => r.data);

// Send to client
res.json({
  snapshot,
  revision: latestRev ?? 0,
});

// Client-side: Initialize from snapshot
const client = new OTClient({
  type: TextType,
  initialSnapshot: snapshot,
  initialRevision: latestRev ?? 0,
  transport,
});
```

## AWS Configuration

### IAM Permissions

The adapter requires the following S3 permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::my-snapshots/*"
    }
  ]
}
```

### Environment Variables

Configure AWS credentials using environment variables:

```bash
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_REGION=us-east-1
```

Or use IAM roles (recommended for EC2/Lambda):

```typescript
// No credentials needed, uses instance role
const adapter = new S3SnapshotAdapter('my-snapshots', 'us-east-1');
```

## Production Best Practices

### Lifecycle Policies

Configure S3 lifecycle policies to archive old snapshots:

```json
{
  "Rules": [
    {
      "Id": "ArchiveOldSnapshots",
      "Status": "Enabled",
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 90,
          "StorageClass": "GLACIER"
        }
      ]
    }
  ]
}
```

### Versioning

Enable S3 versioning for disaster recovery:

```bash
aws s3api put-bucket-versioning \
  --bucket my-snapshots \
  --versioning-configuration Status=Enabled
```

### Cross-Region Replication

For high availability, replicate snapshots to another region:

```bash
aws s3api put-bucket-replication \
  --bucket my-snapshots \
  --replication-configuration file://replication.json
```

## Cost Optimization

- **Snapshot frequency**: Balance between initialization speed and storage costs.
- **Compression**: Compress snapshots before saving (e.g., gzip).
- **Storage class**: Use S3 Standard-IA for infrequently accessed snapshots.

**Example with compression:**

```typescript
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

async function saveCompressedSnapshot(docId: string, revision: number, snapshot: unknown) {
  const json = JSON.stringify(snapshot);
  const compressed = await gzipAsync(json);
  
  await s3.s3.send(new PutObjectCommand({
    Bucket: s3.bucket,
    Key: `snapshots/${docId}/${revision}.json.gz`,
    Body: compressed,
    ContentType: 'application/gzip',
  }));
}
```

## Monitoring

Track snapshot metrics:

- **Snapshot size**: Monitor S3 object sizes
- **Snapshot age**: Track time since last snapshot
- **Retrieval latency**: Measure `loadSnapshot` performance

## License

MIT
