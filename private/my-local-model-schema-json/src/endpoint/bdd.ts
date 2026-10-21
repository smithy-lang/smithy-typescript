// smithy-typescript generated code
import { BinaryDecisionDiagram } from "@smithy/core/endpoints";

const d="x-api-key";
const a="isSet",
b="{endpoint}",
c=["{ApiKey}"];
const _data={
  conditions: [
    [a,[{ref:"endpoint"}]],
    [a,[{ref:"ApiKey"}]],
    [a,[{ref:"CustomHeaderValue"}]]
  ],
  results: [
    [-1],
    [b,{},{[d]:c,"x-custom-header":["{CustomHeaderValue}"]}],
    [b,{},{[d]:c}],
    [b,{}],
    [-1,"endpoint is not set - you must configure an endpoint."]
  ]
};

const root = 2;
const r = 100_000_000;
const nodes = new Int32Array([
  -1, 1, -1,
  0, 3, r + 4,
  1, 4, r + 3,
  2, r + 1, r + 2,
]);
export const bdd = BinaryDecisionDiagram.from(
  nodes, root, _data.conditions, _data.results
);
