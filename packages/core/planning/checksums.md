# Checksum Benchmarks

Platform: Node.js v22.22.2 (linux x64)

Date: 2026-06-23T20:05:13.155Z

Iterations: 500, Warmup: 50

## CRC-32

| Size | Crc32Js (JS) | Crc32Node (node:zlib) | @aws-crypto/crc32 |
| ---- | ------------ | --------------------- | ----------------- |
| 32B  | 12.1 MB/s    | 22.8 MB/s             | 4.8 MB/s          |
| 256B | 96.3 MB/s    | 294.8 MB/s            | 39.8 MB/s         |
| 1KB  | 112.0 MB/s   | 938.7 MB/s            | 75.9 MB/s         |
| 64KB | 120.8 MB/s   | 3.74 GB/s             | 96.8 MB/s         |
| 1MB  | 121.2 MB/s   | 4.75 GB/s             | 98.4 MB/s         |

## SHA-256 (hash)

| Size | Sha256Js (JS) | Sha256Node (node:crypto) | @aws-crypto/sha256-js |
| ---- | ------------- | ------------------------ | --------------------- |
| 32B  | 3.7 MB/s      | 12.9 MB/s                | 2.5 MB/s              |
| 256B | 49.7 MB/s     | 110.6 MB/s               | 21.7 MB/s             |
| 1KB  | 99.9 MB/s     | 360.7 MB/s               | 63.1 MB/s             |
| 64KB | 124.1 MB/s    | 1.60 GB/s                | 108.2 MB/s            |
| 1MB  | 124.4 MB/s    | 1.69 GB/s                | 108.8 MB/s            |

## SHA-256 (HMAC)

| Size | Sha256Js (JS) | Sha256Node (node:crypto) | @aws-crypto/sha256-js |
| ---- | ------------- | ------------------------ | --------------------- |
| 32B  | 2.3 MB/s      | 8.1 MB/s                 | 2.5 MB/s              |
| 256B | 36.5 MB/s     | 31.9 MB/s                | 24.2 MB/s             |
| 1KB  | 61.5 MB/s     | 266.0 MB/s               | 54.6 MB/s             |
| 64KB | 122.6 MB/s    | 1.56 GB/s                | 99.0 MB/s             |
| 1MB  | 124.3 MB/s    | 1.69 GB/s                | 99.8 MB/s             |
