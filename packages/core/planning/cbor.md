# CBOR Performance Benchmarks

Script: `yarn test:cbor:perf` in core.

## Test Cases

| Test Case                          | Data Size | Repetitions | CBOR Cumulative | JSON Cumulative | CBOR/JSON Size |
| ---------------------------------- | --------: | ----------: | --------------: | --------------: | -------------: |
| `string`                           |    413 kb |          60 |           25 mb |           25 mb |           1.00 |
| `list<string(0,180)>`              |    477 kb |          60 |           29 mb |           29 mb |           0.99 |
| `list<float>`                      |    270 kb |          60 |           16 mb |           40 mb |           0.40 |
| `list<double>`                     |    270 kb |          60 |           16 mb |           42 mb |           0.38 |
| `list<int>`                        |    253 kb |          60 |           15 mb |           27 mb |           0.55 |
| `list<long int>`                   |    250 kb |          60 |           15 mb |           33 mb |           0.46 |
| `list<long long int>`              |    450 kb |          60 |           27 mb |           66 mb |           0.41 |
| `map<string(0,30), string(0,450)>` |    453 kb |          60 |           27 mb |           27 mb |           0.99 |
| `map<string(0,30), long int>`      |     37 kb |          60 |            2 mb |            3 mb |           0.75 |
| `list<struct> PutMetricData-like`  |    363 kb |          60 |           22 mb |           28 mb |           0.79 |
| `struct PutMetricData realistic`   |    1.7 mb |          60 |          101 mb |          130 mb |           0.78 |
| `list<struct> non-ASCII keys`      |    399 kb |          60 |           24 mb |           29 mb |           0.83 |

## Benchmark Results

### Baseline: @smithy/core (npm)

| Test Case                          | CBOR ser | CBOR de | CBOR ser ms | CBOR de ms | JSON ser ms | JSON de ms |
| ---------------------------------- | -------: | ------: | ----------: | ---------: | ----------: | ---------: |
| `string`                           |  517mb/s | 369mb/s |       48 ms |      67 ms |       72 ms |      31 ms |
| `list<string(0,180)>`              |  724mb/s | 991mb/s |       39 ms |      29 ms |       39 ms |      16 ms |
| `list<float>`                      |  181mb/s | 295mb/s |       90 ms |      55 ms |      212 ms |     178 ms |
| `list<double>`                     |  150mb/s | 294mb/s |      108 ms |      55 ms |      242 ms |     173 ms |
| `list<int>`                        |   96mb/s | 165mb/s |      159 ms |      92 ms |       99 ms |      96 ms |
| `list<long int>`                   |  211mb/s | 280mb/s |       71 ms |      54 ms |      129 ms |     107 ms |
| `list<long long int>`              |  160mb/s | 112mb/s |      169 ms |     240 ms |      362 ms |     260 ms |
| `map<string(0,30), string(0,450)>` |  725mb/s | 676mb/s |       37 ms |      40 ms |       42 ms |      23 ms |
| `map<string(0,30), long int>`      |  228mb/s | 104mb/s |       10 ms |      22 ms |       10 ms |      14 ms |
| `list<struct> PutMetricData-like`  |  154mb/s |  78mb/s |      142 ms |     281 ms |       88 ms |     153 ms |
| `struct PutMetricData realistic`   |  174mb/s |  88mb/s |      581 ms |    1144 ms |      350 ms |     566 ms |
| `list<struct> non-ASCII keys`      |  128mb/s |  86mb/s |      188 ms |     279 ms |       71 ms |     105 ms |

CBOR timing ratio (lower is better):

| Test Case                          | CBOR ser ratio | CBOR de ratio |
| ---------------------------------- | -------------: | ------------: |
| `string`                           |           0.66 |          2.16 |
| `list<string(0,180)>`              |           1.00 |          1.84 |
| `list<float>`                      |           0.42 |          0.31 |
| `list<double>`                     |           0.45 |          0.32 |
| `list<int>`                        |           1.61 |          0.96 |
| `list<long int>`                   |           0.55 |          0.50 |
| `list<long long int>`              |           0.47 |          0.92 |
| `map<string(0,30), string(0,450)>` |           0.88 |          1.74 |
| `map<string(0,30), long int>`      |           0.95 |          1.52 |
| `list<struct> PutMetricData-like`  |           1.61 |          1.84 |
| `struct PutMetricData realistic`   |           1.66 |          2.02 |
| `list<struct> non-ASCII keys`      |           2.65 |          2.66 |

### June 2026 optimizations

| Test Case                          | CBOR ser |  CBOR de | CBOR ser ms | CBOR de ms | JSON ser ms | JSON de ms |
| ---------------------------------- | -------: | -------: | ----------: | ---------: | ----------: | ---------: |
| `string`                           |  683mb/s |  369mb/s |       36 ms |      67 ms |       72 ms |      31 ms |
| `list<string(0,180)>`              |  761mb/s | 1264mb/s |       38 ms |      23 ms |       39 ms |      16 ms |
| `list<float>`                      |  275mb/s |  408mb/s |       59 ms |      40 ms |      212 ms |     178 ms |
| `list<double>`                     |  273mb/s |  408mb/s |       59 ms |      40 ms |      242 ms |     173 ms |
| `list<int>`                        |   92mb/s |  173mb/s |      165 ms |      88 ms |       99 ms |      96 ms |
| `list<long int>`                   |  203mb/s |  300mb/s |       74 ms |      50 ms |      129 ms |     107 ms |
| `list<long long int>`              |  310mb/s |  187mb/s |       87 ms |     145 ms |      362 ms |     260 ms |
| `map<string(0,30), string(0,450)>` |  796mb/s |  824mb/s |       34 ms |      33 ms |       42 ms |      23 ms |
| `map<string(0,30), long int>`      |  232mb/s |  108mb/s |        9 ms |      20 ms |       10 ms |      14 ms |
| `list<struct> PutMetricData-like`  |  232mb/s |  149mb/s |       94 ms |     146 ms |       88 ms |     153 ms |
| `struct PutMetricData realistic`   |  253mb/s |  157mb/s |      398 ms |     643 ms |      350 ms |     566 ms |
| `list<struct> non-ASCII keys`      |  289mb/s |   87mb/s |       83 ms |     276 ms |       71 ms |     105 ms |

CBOR timing ratio (lower is better):

| Test Case                          | CBOR ser ratio | CBOR de ratio |
| ---------------------------------- | -------------: | ------------: |
| `string`                           |           0.50 |          2.16 |
| `list<string(0,180)>`              |           0.97 |          1.44 |
| `list<float>`                      |           0.28 |          0.22 |
| `list<double>`                     |           0.24 |          0.23 |
| `list<int>`                        |           1.67 |          0.92 |
| `list<long int>`                   |           0.57 |          0.47 |
| `list<long long int>`              |           0.24 |          0.56 |
| `map<string(0,30), string(0,450)>` |           0.81 |          1.43 |
| `map<string(0,30), long int>`      |           0.90 |          1.43 |
| `list<struct> PutMetricData-like`  |           1.07 |          0.95 |
| `struct PutMetricData realistic`   |           1.14 |          1.14 |
| `list<struct> non-ASCII keys`      |           1.17 |          2.63 |

- **Integer encoding without BigInt**: integers > 32 bits are written as two
  `setUint32` calls instead of allocating a `BigInt` for `setBigUint64`.
  Tightened `ensureSpace` checks avoid redundant capacity calculations per
  loop iteration.

- **Generational string caches**: short strings
  are cached as encoded/decoded values with 2048 capacity. Each `serialize()`/`deserialize()`
  call advances a generation counter. Eviction is only allowed if the inhabitant is from a prior
  generation.
  - This handles two common categories of data:
    - Data containing repeated shapes have their keys (and values, if enumerable) cached.
    - Maps with many arbitrary string keys/values are prevented from thrashing the cache within in a single
      generation.

## June 2026 CBOR incremental diff against baseline

Blank deltas are <5% diff.

| Test Case                         | Δ ser throughput |     Δ ser time | Δ de throughput |       Δ de time |
| --------------------------------- | ---------------: | -------------: | --------------: | --------------: |
| string                            |             +32% |   48ms -> 36ms |                 |                 |
| list\<string(0,180)>              |                  |                |            +28% |    29ms -> 23ms |
| list\<float>                      |             +52% |   90ms -> 59ms |            +38% |    55ms -> 40ms |
| list\<double>                     |             +82% |  108ms -> 59ms |            +39% |    55ms -> 40ms |
| list\<int>                        |                  |                |             +5% |    92ms -> 88ms |
| list\<long int>                   |                  |                |             +7% |    54ms -> 50ms |
| list\<long long int>              |             +94% |  169ms -> 87ms |            +67% |  240ms -> 145ms |
| map\<string(0,30), string(0,450)> |             +10% |   37ms -> 34ms |            +22% |    40ms -> 33ms |
| map\<string(0,30), long int>      |                  |                |                 |                 |
| list\<struct> PutMetricData-like  |             +51% |  142ms -> 94ms |            +92% |  281ms -> 146ms |
| struct PutMetricData realistic    |             +45% | 581ms -> 398ms |            +78% | 1144ms -> 643ms |
| list\<struct> non-ASCII keys      |            +126% |  188ms -> 83ms |                 |                 |

## July 2026 CBOR vs JSON Schema-Serde

The previous benchmarks use general-object serde, JSON.stringify / JSON.parse native API vs the general purpose `cbor` codec.
This test is for the respective schema-aware (Smithy) Shape serializers and deserializers.

The following is a baseline comparison between the multi-pass CBOR and multi-pass JSON implementations,
which prepare objects for general-purpose serialization and then retraverse for that serialization.
Later benchmarks will use the single-pass implementations to be released later.

## Serialization Results

| Test Case                         | CBOR Size | JSON Size | CBOR ms | JSON ms | CBOR/JSON |
| --------------------------------- | --------: | --------: | ------: | ------: | --------: |
| `list<string(0,180)>`             |    472 kb |    475 kb |   63 ms |   50 ms |     1.28x |
| `list<float>`                     |    270 kb |    675 kb |  295 ms |  345 ms |     0.86x |
| `list<int>`                       |    253 kb |    458 kb |  746 ms |  298 ms |     2.50x |
| `list<long int>`                  |    250 kb |    549 kb |  383 ms |  231 ms |     1.66x |
| `map<string, string>`             |    451 kb |    449 kb |   58 ms |   55 ms |     1.05x |
| `map<string, long int>`           |     37 kb |     50 kb |   26 ms |   20 ms |     1.28x |
| `list<struct> PutMetricData-like` |    363 kb |    459 kb |  504 ms |  460 ms |     1.10x |
| `struct PutMetricData realistic`  |    1.7 mb |    2.2 mb | 1895 ms | 1659 ms |     1.14x |
| `list<struct> non-ASCII keys`     |    399 kb |    483 kb |  354 ms |  316 ms |     1.12x |
| `list<struct> with blobs`         |    263 kb |    353 kb |  176 ms |  157 ms |     1.12x |
| `list<struct> with timestamps`    |    229 kb |    345 kb |  302 ms |  242 ms |     1.25x |

## Deserialization Results

| Test Case                         | CBOR Size | JSON Size | CBOR ms | JSON ms | CBOR/JSON |
| --------------------------------- | --------: | --------: | ------: | ------: | --------: |
| `list<string(0,180)>`             |    469 kb |    472 kb |   34 ms |   30 ms |     1.15x |
| `list<float>`                     |    270 kb |    675 kb |   74 ms |  257 ms |     0.29x |
| `list<int>`                       |    253 kb |    458 kb |  254 ms |  319 ms |     0.80x |
| `list<long int>`                  |    250 kb |    549 kb |  131 ms |  214 ms |     0.61x |
| `map<string, string>`             |    445 kb |    449 kb |   39 ms |   34 ms |     1.14x |
| `map<string, long int>`           |     38 kb |     50 kb |   28 ms |   26 ms |     1.07x |
| `list<struct> PutMetricData-like` |    363 kb |    459 kb |  429 ms |  481 ms |     0.89x |
| `struct PutMetricData realistic`  |    1.7 mb |    2.2 mb | 2160 ms | 2044 ms |     1.06x |
| `list<struct> non-ASCII keys`     |    399 kb |    483 kb |  474 ms |  381 ms |     1.24x |
| `list<struct> with blobs`         |    263 kb |    353 kb |  101 ms |  235 ms |     0.43x |
| `list<struct> with timestamps`    |    229 kb |    345 kb |  222 ms |  286 ms |     0.78x |
