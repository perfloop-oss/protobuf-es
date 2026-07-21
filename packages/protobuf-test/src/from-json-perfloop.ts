// Copyright 2021-2026 Buf Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import Benchmark from "benchmark";
import { fromJson, type JsonValue } from "@bufbuild/protobuf";
import { PerfMessageSchema } from "./gen/ts/extra/perf_pb.js";

interface Workload {
  metric: string;
  inputs: readonly JsonValue[];
  expectedIds: readonly number[];
  expectedNestedIds: readonly (number | undefined)[];
  expectedLabels: readonly string[];
}

const wideNestedWorkload: Workload = {
  metric: "from_json_wide_nested_ns_per_op",
  inputs: [makeInput(617, 701, "first"), makeInput(619, 709, "second")],
  expectedIds: [617, 619],
  expectedNestedIds: [701, 709],
  expectedLabels: ["first", "second"],
};

const tinyWorkload: Workload = {
  metric: "from_json_tiny_ns_per_op",
  inputs: [{ id: 617 }, { id: 619 }],
  expectedIds: [617, 619],
  expectedNestedIds: [undefined, undefined],
  expectedLabels: ["", ""],
};

if (process.argv.includes("--gc-probe")) {
  runGcProbe(wideNestedWorkload);
} else {
  runBenchmark(selectWorkload(process.argv[2] ?? "wide"));
}

function selectWorkload(name: string): Workload {
  switch (name) {
    case "wide":
      return wideNestedWorkload;
    case "tiny":
      return tinyWorkload;
    default:
      throw new Error(`unknown workload ${JSON.stringify(name)}`);
  }
}

function runBenchmark(workload: Workload): void {
  let inputIndex = 0;
  let lastId = 0;
  const benchmark = new Benchmark(
    "fromJson",
    () => {
      const index = inputIndex;
      inputIndex = (inputIndex + 1) % workload.inputs.length;
      const message = fromJson(PerfMessageSchema, workload.inputs[index]!);
      if (
        message.id !== workload.expectedIds[index] ||
        message.smallMessageField?.id !== workload.expectedNestedIds[index] ||
        message.stringField !== workload.expectedLabels[index]
      ) {
        throw new Error("fromJson returned an unexpected message");
      }
      lastId = message.id;
    },
    {
      async: false,
      maxTime: 0.5,
      minSamples: 5,
      minTime: 0.05,
    },
  );
  benchmark.run();
  if (benchmark.error) {
    throw benchmark.error;
  }
  if (!Number.isFinite(benchmark.hz) || benchmark.hz <= 0 || lastId === 0) {
    throw new Error("benchmark did not complete a decode");
  }
  process.stdout.write(
    `${JSON.stringify({
      metric: workload.metric,
      value: 1_000_000_000 / benchmark.hz,
    })}\n`,
  );
}

function runGcProbe(workload: Workload): void {
  for (let i = 0; i < 100_000; i++) {
    const index = i % workload.inputs.length;
    const message = fromJson(PerfMessageSchema, workload.inputs[index]!);
    if (
      message.id !== workload.expectedIds[index] ||
      message.smallMessageField?.id !== workload.expectedNestedIds[index] ||
      message.stringField !== workload.expectedLabels[index]
    ) {
      throw new Error("fromJson returned an unexpected message");
    }
  }
}

function makeInput(id: number, nestedId: number, label: string): JsonValue {
  return {
    doubleField: 0.75,
    int32Field: -123,
    uint32Field: 456,
    int64Field: "-789",
    boolField: true,
    stringField: label,
    bytesField: "AQIDBA==",
    enumField: "PERF_ENUM_YES",
    smallMessageField: {
      doubleField: 0.25,
      int32Field: -23,
      uint32Field: 56,
      int64Field: "-89",
      boolField: false,
      stringField: `${label}-nested`,
      bytesField: "BQYHCA==",
      enumField: "PERF_ENUM_NO",
      unusedField1: 11,
      unusedField2: 12,
      unusedField3: 13,
      unusedField4: 14,
      unusedField5: 15,
      unusedField6: 16,
      unusedField7: 17,
      unusedField8: 18,
      unusedField9: 19,
      unusedField10: 20,
      id: nestedId,
    },
    unusedField1: 1,
    unusedField2: 2,
    unusedField3: 3,
    unusedField4: 4,
    unusedField5: 5,
    unusedField6: 6,
    unusedField7: 7,
    unusedField8: 8,
    unusedField9: 9,
    unusedField10: 10,
    id,
  };
}
