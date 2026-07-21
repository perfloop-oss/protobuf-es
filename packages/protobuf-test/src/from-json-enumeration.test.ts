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

import { test } from "node:test";
import * as assert from "node:assert";
import { fromJson, type JsonValue } from "@bufbuild/protobuf";
import * as proto3_ts from "./gen/ts/extra/proto3_pb.js";

void test("fromJson ignores inherited enumerable keys", () => {
  const prototype = {};
  Object.defineProperty(prototype, "unknownInheritedField", {
    enumerable: true,
    get() {
      throw new Error("fromJson must not read inherited JSON keys");
    },
  });
  const json = Object.create(prototype) as Record<string, JsonValue>;
  json.singularStringField = "own value";

  const message = fromJson(proto3_ts.Proto3MessageSchema, json);

  assert.strictEqual(message.singularStringField, "own value");
});

void test("fromJson accepts a null-prototype JSON object", () => {
  const json = Object.create(null) as Record<string, JsonValue>;
  json.singularStringField = "null prototype";

  const message = fromJson(proto3_ts.Proto3MessageSchema, json);

  assert.strictEqual(message.singularStringField, "null prototype");
});
