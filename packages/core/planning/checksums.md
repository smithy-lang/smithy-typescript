# Checksum Benchmarks

Platform: Node.js v22.22.2 (linux x64)

Date: 2026-06-24T17:04:04.733Z

Iterations per size: [10000, 5000, 2000, 200, 20, 5, 3], Warmup: 1s per algo

## CRC-32

| Size | Crc32Js (JS) | Crc32Node (node:zlib) | @aws-crypto/crc32 |
| ---- | ------------ | --------------------- | ----------------- |
| 32B  | 35.3 MB/s    | 34.4 MB/s             | 28.8 MB/s         |
| 256B | 96.0 MB/s    | 307.9 MB/s            | 77.9 MB/s         |
| 1KB  | 116.1 MB/s   | 1.31 GB/s             | 90.4 MB/s         |
| 64KB | 121.0 MB/s   | 4.52 GB/s             | 101.4 MB/s        |
| 1MB  | 121.2 MB/s   | 4.76 GB/s             | 100.8 MB/s        |
| 10MB | 121.2 MB/s   | 4.76 GB/s             | 100.3 MB/s        |
| 50MB | 121.2 MB/s   | 4.74 GB/s             | 100.9 MB/s        |

## SHA-256 (hash)

| Size | Sha256Js (JS) | Sha256Node (node:crypto) | @aws-crypto/sha256-js |
| ---- | ------------- | ------------------------ | --------------------- |
| 32B  | 9.4 MB/s      | 11.5 MB/s                | 5.2 MB/s              |
| 256B | 49.0 MB/s     | 71.8 MB/s                | 35.0 MB/s             |
| 1KB  | 92.4 MB/s     | 211.5 MB/s               | 69.8 MB/s             |
| 64KB | 116.4 MB/s    | 1.58 GB/s                | 99.9 MB/s             |
| 1MB  | 118.8 MB/s    | 1.69 GB/s                | 100.4 MB/s            |
| 10MB | 118.9 MB/s    | 1.70 GB/s                | 100.6 MB/s            |
| 50MB | 118.7 MB/s    | 1.70 GB/s                | 100.6 MB/s            |

## SHA-256 (HMAC)

| Size | Sha256Js (JS) | Sha256Node (node:crypto) | @aws-crypto/sha256-js |
| ---- | ------------- | ------------------------ | --------------------- |
| 32B  | 3.0 MB/s      | 10.6 MB/s                | 2.7 MB/s              |
| 256B | 20.2 MB/s     | 76.7 MB/s                | 20.0 MB/s             |
| 1KB  | 60.4 MB/s     | 344.0 MB/s               | 55.3 MB/s             |
| 64KB | 115.9 MB/s    | 1.59 GB/s                | 99.6 MB/s             |
| 1MB  | 118.5 MB/s    | 1.69 GB/s                | 100.4 MB/s            |
| 10MB | 119.0 MB/s    | 1.70 GB/s                | 100.2 MB/s            |
| 50MB | 115.4 MB/s    | 1.70 GB/s                | 100.6 MB/s            |

## MD5

Md5Js vs old @smithy/md5-js (unrolled rounds): 0.9x (32B), 2.2x (256B), 2.2x (1KB), 2.1x (64KB), 2.1x (1MB)

| Size | Md5Js (JS) | Md5Node (node:crypto) |
| ---- | ---------- | --------------------- |
| 32B  | 10.9 MB/s  | 13.3 MB/s             |
| 256B | 58.4 MB/s  | 87.6 MB/s             |
| 1KB  | 114.3 MB/s | 261.1 MB/s            |
| 64KB | 142.7 MB/s | 756.4 MB/s            |
| 1MB  | 143.4 MB/s | 775.8 MB/s            |
| 10MB | 143.6 MB/s | 777.4 MB/s            |
| 50MB | 143.3 MB/s | 777.6 MB/s            |
