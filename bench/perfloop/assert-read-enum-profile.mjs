// Copyright 2021-2026 Buf Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const directory = process.argv[2];
if (directory === undefined) {
  throw new Error(
    "usage: assert-read-enum-profile.mjs <cpu-profile-directory>",
  );
}
const profileFiles = readdirSync(directory).filter((name) =>
  name.endsWith(".cpuprofile"),
);
if (profileFiles.length === 0) {
  throw new Error("Node did not write a CPU profile");
}

let readEnumSamples = 0;
let totalSamples = 0;
for (const profileFile of profileFiles) {
  const profile = JSON.parse(
    readFileSync(join(directory, profileFile), "utf8"),
  );
  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const parents = new Map();
  for (const node of profile.nodes) {
    for (const child of node.children ?? []) {
      parents.set(child, node.id);
    }
  }
  for (const sample of profile.samples ?? []) {
    totalSamples++;
    let nodeId = sample;
    while (nodeId !== undefined) {
      const node = nodes.get(nodeId);
      if (
        node?.callFrame.functionName === "readEnum" &&
        node.callFrame.url.includes("from-json")
      ) {
        readEnumSamples++;
        break;
      }
      nodeId = parents.get(nodeId);
    }
  }
}

console.log(`readEnum profile samples: ${readEnumSamples} of ${totalSamples}`);
if (readEnumSamples === 0) {
  throw new Error("CPU profile did not attribute samples to readEnum");
}
