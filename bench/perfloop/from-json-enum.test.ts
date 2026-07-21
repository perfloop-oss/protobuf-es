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

import * as assert from "node:assert";
import { suite, test } from "node:test";
import {
  enumFromJson,
  fromJson,
  type DescEnum,
} from "../../packages/protobuf/src/index.ts";
import { createEnumContainerSchema } from "./enum-json-fixture.ts";

type EnumContainer = {
  values: number[];
  byName: Record<string, number>;
  single: number;
};

function decode(
  schema: Parameters<typeof fromJson>[0],
  json: Record<string, unknown>,
  ignoreUnknownFields = false,
): EnumContainer {
  return fromJson(schema, json, {
    ignoreUnknownFields,
  }) as unknown as EnumContainer;
}

void suite("fromJson enum names", () => {
  void test("preserves aliases after repeated list and map lookups", () => {
    const schema = createEnumContainerSchema(16, true);
    const json = {
      values: ["VALUE_15", "VALUE_ALIAS_ZERO", "VALUE_14"],
      byName: {
        last: "VALUE_15",
        alias: "VALUE_ALIAS_ZERO",
      },
      single: "VALUE_13",
    };

    // Repeat enough decodes to exercise any lazy descriptor cache.
    for (let i = 0; i < 16; i++) {
      const decoded = decode(schema, json);
      assert.deepStrictEqual(decoded.values, [15, 0, 14]);
      assert.deepStrictEqual(decoded.byName, { last: 15, alias: 0 });
      assert.strictEqual(decoded.single, 13);
    }
  });

  void test("retains numeric and null enum behavior", () => {
    const schema = createEnumContainerSchema(16);
    const numeric = decode(schema, {
      values: [123],
      byName: { unknownNumber: 456 },
      single: 789,
    });
    assert.deepStrictEqual(numeric.values, [123]);
    assert.deepStrictEqual(numeric.byName, { unknownNumber: 456 });
    assert.strictEqual(numeric.single, 789);

    const enumField = schema.fields.find((field) => field.name === "single");
    assert.ok(enumField?.enum);
    assert.strictEqual(enumFromJson(enumField.enum as DescEnum, null), 0);
    const reset = decode(schema, { single: null });
    assert.strictEqual(reset.single, 0);
    assert.throws(
      () => decode(schema, { values: [null] }),
      /list item must not be null/,
    );
  });

  void test("keeps unknown-name errors and ignoreUnknownFields filtering", () => {
    const schema = createEnumContainerSchema(16);
    assert.throws(
      () => decode(schema, { values: ["VALUE_15", "NOT_A_VALUE"] }),
      /cannot decode enum perfloop\.enumjson\.CachedEnum from JSON/,
    );

    const ignored = decode(
      schema,
      {
        values: ["VALUE_15", "NOT_A_VALUE", "VALUE_14"],
        byName: {
          keep: "VALUE_13",
          drop: "NOT_A_VALUE",
        },
      },
      true,
    );
    assert.deepStrictEqual(ignored.values, [15, 14]);
    assert.deepStrictEqual(ignored.byName, { keep: 13 });
  });
});
