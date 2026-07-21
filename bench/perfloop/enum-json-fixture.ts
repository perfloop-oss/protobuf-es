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

import {
  create,
  createFileRegistry,
  fromJson,
  type DescMessage,
} from "../../packages/protobuf/src/index.ts";
import { FileDescriptorSetSchema } from "../../packages/protobuf/src/wkt/gen/google/protobuf/descriptor_pb.ts";

export interface EnumListPayload {
  readonly json: { readonly values: readonly string[] };
  readonly checksum: number;
}

export interface EnumListWorkload {
  readonly schema: DescMessage;
  readonly payloads: readonly EnumListPayload[];
}

export function enumValueName(value: number): string {
  return `VALUE_${value}`;
}

/**
 * Creates a real protobuf descriptor rather than a look-alike enum object so
 * the workload traverses fromJson(), reflection, and the list enum reader.
 */
export function createEnumContainerSchema(
  enumValueCount: number,
  allowAlias = false,
): DescMessage {
  if (!Number.isInteger(enumValueCount) || enumValueCount < 1) {
    throw new Error(`invalid enum value count: ${enumValueCount}`);
  }
  const enumValues = Array.from({ length: enumValueCount }, (_, number) => ({
    name: enumValueName(number),
    number,
  }));
  if (allowAlias) {
    enumValues.push({ name: "VALUE_ALIAS_ZERO", number: 0 });
  }
  const fileDescriptorSet = create(FileDescriptorSetSchema, {
    file: [
      {
        name: "perfloop/enum-json.proto",
        package: "perfloop.enumjson",
        syntax: "proto3",
        enumType: [
          {
            name: "CachedEnum",
            options: allowAlias ? { allowAlias: true } : undefined,
            value: enumValues,
          },
        ],
        messageType: [
          {
            name: "EnumContainer",
            field: [
              {
                name: "values",
                number: 1,
                label: 3,
                type: 14,
                typeName: ".perfloop.enumjson.CachedEnum",
              },
              {
                name: "by_name",
                jsonName: "byName",
                number: 2,
                label: 3,
                type: 11,
                typeName: ".perfloop.enumjson.EnumContainer.ByNameEntry",
              },
              {
                name: "single",
                number: 3,
                label: 1,
                type: 14,
                typeName: ".perfloop.enumjson.CachedEnum",
              },
            ],
            nestedType: [
              {
                name: "ByNameEntry",
                options: { mapEntry: true },
                field: [
                  {
                    name: "key",
                    number: 1,
                    label: 1,
                    type: 9,
                  },
                  {
                    name: "value",
                    number: 2,
                    label: 1,
                    type: 14,
                    typeName: ".perfloop.enumjson.CachedEnum",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
  const schema = createFileRegistry(fileDescriptorSet).getMessage(
    "perfloop.enumjson.EnumContainer",
  );
  if (schema === undefined) {
    throw new Error("missing enum container descriptor");
  }
  return schema;
}

/**
 * Make several runtime-selected JSON payloads. The names are near the end of
 * the descriptor so the baseline's linear scan pays its representative cost.
 */
export function createEnumListWorkload(
  enumValueCount: number,
  itemCount: number,
  runtimeSeed: number,
): EnumListWorkload {
  if (!Number.isInteger(itemCount) || itemCount < 1) {
    throw new Error(`invalid item count: ${itemCount}`);
  }
  const schema = createEnumContainerSchema(enumValueCount);
  const variants = Math.min(enumValueCount, 4);
  const payloads = Array.from({ length: variants }, (_, variant) => {
    const values = Array.from({ length: itemCount }, (_, item) => {
      const offset = (runtimeSeed + variant + item) % variants;
      return enumValueName(enumValueCount - 1 - offset);
    });
    return {
      json: { values },
      checksum: values.reduce((sum, value) => sum + Number(value.slice(6)), 0),
    };
  });
  return { schema, payloads };
}

/**
 * Validate setup inputs and warm any descriptor-local state before timing a
 * steady-state decode. The timed operation still allocates and consumes a new
 * decoded message on every invocation.
 */
export function verifyEnumListWorkload(workload: EnumListWorkload): void {
  for (const payload of workload.payloads) {
    const decoded = fromJson(workload.schema, payload.json) as unknown as {
      values: number[];
    };
    const checksum = decoded.values.reduce((sum, value) => sum + value, 0);
    if (checksum !== payload.checksum) {
      throw new Error(
        `unexpected decoded checksum: got ${checksum}, want ${payload.checksum}`,
      );
    }
  }
}
