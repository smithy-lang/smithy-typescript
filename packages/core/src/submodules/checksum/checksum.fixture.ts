/**
 * Shared Known Answer Test vectors for checksum implementations.
 * Exported for use across multiple spec files.
 */

const fromHex = (hex: string) => new Uint8Array(hex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
const utf8 = (s: string) => new TextEncoder().encode(s);
const aBytes = (n: number) => fromHex("61".repeat(n));

export { fromHex, utf8 };

export const toHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

// --- CRC-32 vectors ---

export const crc32Vectors: [Uint8Array, number][] = [
  [new Uint8Array(0), 0x00000000],
  [utf8("123456789"), 0xcbf43926], // ITU-T V.42 check value
  [utf8("The quick brown fox jumps over the lazy dog"), 0x414fa339],
  [utf8("Sphinx of black quartz, judge my vow."), 0xa839a3df],
];

export const crc32IncrementalChunks: [Uint8Array, number][] = [
  [utf8("The "), 746075],
  [utf8("quick "), 2750157876],
  [utf8("brown "), 3357223548],
  [utf8("fox "), 2293265890],
  [utf8("jumps "), 330596039],
  [utf8("over "), 2281844364],
  [utf8("the "), 3828401820],
  [utf8("lazy "), 3693501045],
  [utf8("dog"), 0x414fa339],
];

// --- SHA-256 hash vectors ---
// Progressive 'a' repetitions (1–64 bytes) exercise every bufferLength boundary.
// From @aws-crypto/sha256-js knownHashes.fixture.ts

export const sha256HashVectors: [Uint8Array, string][] = [
  [new Uint8Array(0), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
  [Uint8Array.from([97, 98, 99]), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
  [aBytes(1), "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb"],
  [aBytes(2), "961b6dd3ede3cb8ecbaacbd68de040cd78eb2ed5889130cceb4c49268ea4d506"],
  [aBytes(3), "9834876dcfb05cb167a5c24953eba58c4ac89b1adf57f28f2f9d09af107ee8f0"],
  [aBytes(4), "61be55a8e2f6b4e172338bddf184d6dbee29c98853e0a0485ecee7f27b9af0b4"],
  [aBytes(5), "ed968e840d10d2d313a870bc131a4e2c311d7ad09bdf32b3418147221f51a6e2"],
  [aBytes(6), "ed02457b5c41d964dbd2f2a609d63fe1bb7528dbe55e1abf5b52c249cd735797"],
  [aBytes(7), "e46240714b5db3a23eee60479a623efba4d633d27fe4f03c904b9e219a7fbe60"],
  [aBytes(8), "1f3ce40415a2081fa3eee75fc39fff8e56c22270d1a978a7249b592dcebd20b4"],
  [aBytes(9), "f2aca93b80cae681221f0445fa4e2cae8a1f9f8fa1e1741d9639caad222f537d"],
  [aBytes(10), "bf2cb58a68f684d95a3b78ef8f661c9a4e5b09e82cc8f9cc88cce90528caeb27"],
  [aBytes(11), "28cb017dfc99073aa1b47c1b30f413e3ce774c4991eb4158de50f9dbb36d8043"],
  [aBytes(12), "f24abc34b13fade76e805799f71187da6cd90b9cac373ae65ed57f143bd664e5"],
  [aBytes(13), "a689d786e81340e45511dec6c7ab2d978434e5db123362450fe10cfac70d19d0"],
  [aBytes(14), "82cab7df0abfb9d95dca4e5937ce2968c798c726fea48c016bf9763221efda13"],
  [aBytes(15), "ef2df0b539c6c23de0f4cbe42648c301ae0e22e887340a4599fb4ef4e2678e48"],
  [aBytes(16), "0c0beacef8877bbf2416eb00f2b5dc96354e26dd1df5517320459b1236860f8c"],
  [aBytes(17), "b860666ee2966dd8f903be44ee605c6e1366f926d9f17a8f49937d11624eb99d"],
  [aBytes(18), "c926defaaa3d13eda2fc63a553bb7fb7326bece6e7cb67ca5296e4727d89bab4"],
  [aBytes(19), "a0b4aaab8a966e2193ba172d68162c4656860197f256b5f45f0203397ff3f99c"],
  [aBytes(20), "42492da06234ad0ac76f5d5debdb6d1ae027cffbe746a1c13b89bb8bc0139137"],
  [aBytes(21), "7df8e299c834de198e264c3e374bc58ecd9382252a705c183beb02f275571e3b"],
  [aBytes(22), "ec7c494df6d2a7ea36668d656e6b8979e33641bfea378c15038af3964db057a3"],
  [aBytes(23), "897d3e95b65f26676081f8b9f3a98b6ee4424566303e8d4e7c7522ebae219eab"],
  [aBytes(24), "09f61f8d9cd65e6a0c258087c485b6293541364e42bd97b2d7936580c8aa3c54"],
  [aBytes(25), "2f521e2a7d0bd812cbc035f4ed6806eb8d851793b04ba147e8f66b72f5d1f20f"],
  [aBytes(26), "9976d549a25115dab4e36d0c1fb8f31cb07da87dd83275977360eb7dc09e88de"],
  [aBytes(27), "cc0616e61cbd6e8e5e34e9fb2d320f37de915820206f5696c31f1fbd24aa16de"],
  [aBytes(28), "9c547cb8115a44883b9f70ba68f75117cd55359c92611875e386f8af98c172ab"],
  [aBytes(29), "6913c9c7fd42fe23df8b6bcd4dbaf1c17748948d97f2980b432319c39eddcf6c"],
  [aBytes(30), "3a54fc0cbc0b0ef48b6507b7788096235d10292dd3ae24e22f5aa062d4f9864a"],
  [aBytes(31), "61c60b487d1a921e0bcc9bf853dda0fb159b30bf57b2e2d2c753b00be15b5a09"],
  [aBytes(32), "3ba3f5f43b92602683c19aee62a20342b084dd5971ddd33808d81a328879a547"],
  [aBytes(33), "852785c805c77e71a22340a54e9d95933ed49121e7d2bf3c2d358854bc1359ea"],
  [aBytes(34), "a27c896c4859204843166af66f0e902b9c3b3ed6d2fd13d435abc020065c526f"],
  [aBytes(35), "629362afc62c74497caed2272e30f8125ecd0965f8d8d7cfc4e260f7f8dd319d"],
  [aBytes(36), "22c1d24bcd03e9aee9832efccd6da613fc702793178e5f12c945c7b67ddda933"],
  [aBytes(37), "21ec055b38ce759cd4d0f477e9bdec2c5b8199945db4439bae334a964df6246c"],
  [aBytes(38), "365a9c3e2c2af0a56e47a9dac51c2c5381bf8f41273bad3175e0e619126ad087"],
  [aBytes(39), "b4d5e56e929ba4cda349e9274e3603d0be246b82016bca20f363963c5f2d6845"],
  [aBytes(40), "e33cdf9c7f7120b98e8c78408953e07f2ecd183006b5606df349b4c212acf43e"],
  [aBytes(41), "c0f8bd4dbc2b0c03107c1c37913f2a7501f521467f45dd0fef6958e9a4692719"],
  [aBytes(42), "7a538607fdaab9296995929f451565bbb8142e1844117322aafd2b3d76b01aff"],
  [aBytes(43), "66d34fba71f8f450f7e45598853e53bfc23bbd129027cbb131a2f4ffd7878cd0"],
  [aBytes(44), "16849877c6c21ef0bfa68e4f6747300ddb171b170b9f00e189edc4c2fc4db93e"],
  [aBytes(45), "52789e3423b72beeb898456a4f49662e46b0cbb960784c5ef4b1399d327e7c27"],
  [aBytes(46), "6643110c5628fff59edf76d82d5bf573bf800f16a4d65dfb1e5d6f1a46296d0b"],
  [aBytes(47), "11eaed932c6c6fddfc2efc394e609facf4abe814fc6180d03b14fce13a07d0e5"],
  [aBytes(48), "97daac0ee9998dfcad6c9c0970da5ca411c86233a944c25b47566f6a7bc1ddd5"],
  [aBytes(49), "8f9bec6a62dd28ebd36d1227745592de6658b36974a3bb98a4c582f683ea6c42"],
  [aBytes(50), "160b4e433e384e05e537dc59b467f7cb2403f0214db15c5db58862a3f1156d2e"],
  [aBytes(51), "bfc5fe0e360152ca98c50fab4ed7e3078c17debc2917740d5000913b686ca129"],
  [aBytes(52), "6c1b3dc7a706b9dc81352a6716b9c666c608d8626272c64b914ab05572fc6e84"],
  [aBytes(53), "abe346a7259fc90b4c27185419628e5e6af6466b1ae9b5446cac4bfc26cf05c4"],
  [aBytes(54), "a3f01b6939256127582ac8ae9fb47a382a244680806a3f613a118851c1ca1d47"],
  [aBytes(55), "9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318"],
  [aBytes(56), "b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a"],
  [aBytes(57), "f13b2d724659eb3bf47f2dd6af1accc87b81f09f59f2b75e5c0bed6589dfe8c6"],
  [aBytes(58), "d5c039b748aa64665782974ec3dc3025c042edf54dcdc2b5de31385b094cb678"],
  [aBytes(59), "111bb261277afd65f0744b247cd3e47d386d71563d0ed995517807d5ebd4fba3"],
  [aBytes(60), "11ee391211c6256460b6ed375957fadd8061cafbb31daf967db875aebd5aaad4"],
  [aBytes(61), "35d5fc17cfbbadd00f5e710ada39f194c5ad7c766ad67072245f1fad45f0f530"],
  [aBytes(62), "f506898cc7c2e092f9eb9fadae7ba50383f5b46a2a4fe5597dbb553a78981268"],
  [aBytes(63), "7d3e74a05d7db15bce4ad9ec0658ea98e3f06eeecf16b4c6fff2da457ddc2f34"],
  [aBytes(64), "ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb"],
  // Non-'a' content
  [
    fromHex(
      "de188941a3375d3a8a061e67576e926dc71a7fa3f0cceb97452b4d3227965f9ea8cc75076d9fb9c5417aa5cb30fc22198b34982dbb629e"
    ),
    "038051e9c324393bd1ca1978dd0952c2aa3742ca4f1bd5cd4611cea83892d382",
  ],
  // 1 million 'a' characters
  [aBytes(1000000), "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0"],
  // 131 bytes of 0xaa
  [fromHex("aa".repeat(131)), "45ad4b37c6e2fc0a2cfcc1b5da524132ec707615c2cae1dbbc43c97aa521db81"],
];

// --- SHA-256 HMAC vectors (RFC 4231) ---

export const sha256HmacVectors: [Uint8Array, Uint8Array, string][] = [
  [
    fromHex("0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b"),
    fromHex("4869205468657265"),
    "b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7",
  ],
  [
    fromHex("4a656665"),
    fromHex("7768617420646f2079612077616e7420666f72206e6f7468696e673f"),
    "5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843",
  ],
  [
    fromHex("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
    fromHex("dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"),
    "773ea91e36800e46854db8ebd09181a72959098b3ef8c122d9635514ced565fe",
  ],
  [
    fromHex("0102030405060708090a0b0c0d0e0f10111213141516171819"),
    fromHex("cdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd"),
    "82558a389a443c0ea4cc819899f2083a85f0faa3e578f8077a2e3ff46729665b",
  ],
  // Key larger than block size (131 bytes)
  [
    fromHex("aa".repeat(131)),
    fromHex(
      "54657374205573696e67204c6172676572205468616e20426c6f636b2d53697a65204b6579202d2048617368204b6579204669727374"
    ),
    "60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54",
  ],
  // Key and data larger than block size
  [
    fromHex("aa".repeat(131)),
    fromHex(
      "5468697320697320612074657374207573696e672061206c6172676572207468616e20626c6f636b2d73697a65206b657920616e642061206c6172676572207468616e20626c6f636b2d73697a6520646174612e20546865206b6579206e6565647320746f20626520686173686564206265666f7265206265696e6720757365642062792074686520484d414320616c676f726974686d2e"
    ),
    "9b09ffa71b942fcb27635fbcd5b0e944bfdc63644f0713938a7f51535c3a35e2",
  ],
];
