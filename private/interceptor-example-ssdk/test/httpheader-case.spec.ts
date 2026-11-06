/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
import { describe, expect, test } from "vitest";

import { HttpRequest } from "@smithy/core/protocols";

import { deserializePingRequest } from "../src/protocols/Fakeprotocol";

const serdeContext = {
  endpoint: async () => ({ protocol: "https:", hostname: "example.com", path: "/" }),
  base64Decoder: (input: string) => Buffer.from(input, "base64"),
  base64Encoder: (input: Uint8Array) => Buffer.from(input).toString("base64"),
  utf8Decoder: (input: string) => Buffer.from(input, "utf8"),
  utf8Encoder: (input: Uint8Array) => Buffer.from(input).toString("utf8"),
  streamCollector: async () => new Uint8Array(),
} as any;

function pingRequest(headers: Record<string, string>) {
  return new HttpRequest({
    method: "POST",
    protocol: "https:",
    hostname: "example.com",
    path: "/ping",
    headers,
    body: "{}",
  });
}

describe("SSDK @httpHeader case-insensitivity (#1969)", () => {
  test.each([
    ["cookie", "a=1"],
    ["Cookie", "a=1"],
    ["COOKIE", "a=1"],
    ["cOoKiE", "a=1"],
  ])('maps %s request header to @httpHeader("cookie")', async (headerName, value) => {
    const input = await deserializePingRequest(pingRequest({ [headerName]: value }), serdeContext);
    expect(input.cookie).toBe(value);
  });

  test("leaves missing cookie undefined", async () => {
    const input = await deserializePingRequest(pingRequest({}), serdeContext);
    expect(input.cookie).toBeUndefined();
  });
});
