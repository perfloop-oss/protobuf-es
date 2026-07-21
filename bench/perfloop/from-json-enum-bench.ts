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

import Benchmark from "benchmark";
import { fromJson } from "../../packages/protobuf/src/index.ts";
import {
  createEnumListWorkload,
  verifyEnumListWorkload,
  type EnumListWorkload,
} from "./enum-json-fixture.ts";

const largeMetric = "fromJson_enum_list_64_values_1024_items_ns_per_op";
const smallMetric = "fromJson_enum_list_3_values_8_items_ns_per_op";

const selector = process.argv[2];
const runtimeSeed = Number.parseInt(
  process.env.PERFLOOP_SEED ?? String(process.pid),
  10,
);

switch (selector) {
  case "large-warm":
    runBenchmark(
      largeMetric,
      createEnumListWorkload(64, 1024, runtimeSeed >>> 0),
    );
    break;
  case "small-fast-path":
    runBenchmark(smallMetric, createEnumListWorkload(3, 8, runtimeSeed >>> 0));
    break;
  case "profile":
    runProfile();
    break;
  default:
    throw new Error(
      "usage: from-json-enum-bench.ts [large-warm|small-fast-path|profile]",
    );
}

function runBenchmark(metric: string, workload: EnumListWorkload): void {
  // Cache construction is amortized by descriptors in ordinary repeated decodes.
  verifyEnumListWorkload(workload);
  let nextPayload = 0;
  let consumed = 0;
  const benchmark = new Benchmark(
    metric,
    () => {
      const payload =
        workload.payloads[nextPayload++ % workload.payloads.length];
      const decoded = fromJson(workload.schema, payload.json) as unknown as {
        values: number[];
      };
      const values = decoded.values;
      const last = values[values.length - 1];
      if (last === undefined) {
        throw new Error("decoded enum list unexpectedly empty");
      }
      // Consume a runtime-varying result so V8 cannot discard the decode.
      consumed += last;
    },
    {
      minSamples: 10,
      minTime: 0.05,
      maxTime: 2,
    },
  );
  benchmark.run();
  if (benchmark.error !== undefined) {
    throw benchmark.error;
  }
  if (consumed <= 0 || !Number.isFinite(benchmark.stats.mean)) {
    throw new Error("benchmark did not consume a valid decoded result");
  }
  console.log(
    JSON.stringify({
      metric,
      value: benchmark.stats.mean * 1_000_000_000,
    }),
  );
}

function runProfile(): void {
  const workload = createEnumListWorkload(64, 1024, runtimeSeed >>> 0);
  verifyEnumListWorkload(workload);
  let consumed = 0;
  const decodeCount = 8_000;
  for (let i = 0; i < decodeCount; i++) {
    const payload = workload.payloads[i % workload.payloads.length];
    const decoded = fromJson(workload.schema, payload.json) as unknown as {
      values: number[];
    };
    const last = decoded.values[decoded.values.length - 1];
    if (last === undefined) {
      throw new Error("decoded enum list unexpectedly empty");
    }
    consumed += last;
  }
  if (consumed <= 0) {
    throw new Error("profile workload did not consume decoded output");
  }
  console.log(`fromJson enum profile completed ${decodeCount} decodes`);
}
