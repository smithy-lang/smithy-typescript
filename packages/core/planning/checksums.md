# Checksum Benchmarks

Platform: Node.js v22.22.2 (linux x64)

Date: 2026-08-14T17:38:50.553Z

Iterations per size: [10000, 5000, 2000, 200, 20, 5, 3], Warmup: 1s per algo

## CRC-32

| Size | Crc32Js (JS) | Crc32Node (node:zlib) | @aws-crypto/crc32 |
| ---- | ------------ | --------------------- | ----------------- |
| 32B  | 34.0 MB/s    | 30.8 MB/s             | 29.1 MB/s         |
| 256B | 95.2 MB/s    | 306.5 MB/s            | 77.5 MB/s         |
| 1KB  | 113.7 MB/s   | 1.19 GB/s             | 91.0 MB/s         |
| 64KB | 121.0 MB/s   | 4.53 GB/s             | 98.7 MB/s         |
| 1MB  | 121.2 MB/s   | 4.74 GB/s             | 99.6 MB/s         |
| 10MB | 121.2 MB/s   | 4.76 GB/s             | 99.4 MB/s         |
| 50MB | 121.2 MB/s   | 4.73 GB/s             | 99.3 MB/s         |

## SHA-256 (hash)

| Size | Sha256Js (JS) | Sha256Node (node:crypto) | @aws-crypto/sha256-js |
| ---- | ------------- | ------------------------ | --------------------- |
| 32B  | 9.8 MB/s      | 11.2 MB/s                | 5.1 MB/s              |
| 256B | 49.7 MB/s     | 68.7 MB/s                | 38.2 MB/s             |
| 1KB  | 94.2 MB/s     | 247.2 MB/s               | 73.5 MB/s             |
| 64KB | 117.8 MB/s    | 1.55 GB/s                | 99.8 MB/s             |
| 1MB  | 118.5 MB/s    | 1.69 GB/s                | 100.4 MB/s            |
| 10MB | 118.7 MB/s    | 1.70 GB/s                | 100.6 MB/s            |
| 50MB | 118.4 MB/s    | 1.70 GB/s                | 100.6 MB/s            |

## SHA-256 (HMAC)

| Size | Sha256Js (JS) | Sha256Node (node:crypto) | @aws-crypto/sha256-js |
| ---- | ------------- | ------------------------ | --------------------- |
| 32B  | 3.0 MB/s      | 10.6 MB/s                | 2.8 MB/s              |
| 256B | 20.7 MB/s     | 78.8 MB/s                | 20.6 MB/s             |
| 1KB  | 61.8 MB/s     | 321.8 MB/s               | 56.0 MB/s             |
| 64KB | 117.3 MB/s    | 1.60 GB/s                | 99.5 MB/s             |
| 1MB  | 118.5 MB/s    | 1.68 GB/s                | 100.4 MB/s            |
| 10MB | 118.8 MB/s    | 1.70 GB/s                | 100.5 MB/s            |
| 50MB | 118.8 MB/s    | 1.70 GB/s                | 100.6 MB/s            |

## MD5

Md5Js vs old @smithy/md5-js (unrolled rounds): 0.9x (32B), 2.2x (256B), 2.2x (1KB), 2.1x (64KB), 2.1x (1MB)

| Size | Md5Js (JS) | Md5Node (node:crypto) |
| ---- | ---------- | --------------------- |
| 32B  | 11.1 MB/s  | 13.3 MB/s             |
| 256B | 58.5 MB/s  | 89.6 MB/s             |
| 1KB  | 114.1 MB/s | 260.6 MB/s            |
| 64KB | 142.6 MB/s | 758.0 MB/s            |
| 1MB  | 143.5 MB/s | 775.4 MB/s            |
| 10MB | 143.6 MB/s | 777.4 MB/s            |
| 50MB | 143.1 MB/s | 777.8 MB/s            |
