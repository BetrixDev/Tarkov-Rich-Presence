import axios from "axios";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import * as z from "zod";
import { DATA_PATH, TEMP_PATH } from "../constants";

const QUERY = /* GraphQL */ `
  {
    maps {
      name
      nameId
      raidDuration
    }
  }
`;

const schema = z.object({
  maps: z.array(
    z.object({
      name: z.string(),
      nameId: z.string(),
      raidDuration: z.number(),
    }),
  ),
});

export async function fetchTarkovDevData() {
  const response = await axios("https://api.tarkov.dev/graphql", {
    method: "post",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    data: JSON.stringify({
      query: QUERY,
    }),
  });

  const parsed = schema.safeParse(response.data.data);

  if (!parsed.success) {
    throw new Error("Bad data?");
  }

  if (!existsSync(TEMP_PATH)) {
    mkdirSync(TEMP_PATH);
  }

  writeFileSync(DATA_PATH, JSON.stringify(parsed.data, null, 2));
}

export async function getData() {
  if (!existsSync(DATA_PATH)) {
    await fetchTarkovDevData();
  }

  const data = JSON.parse(readFileSync(DATA_PATH).toString());

  const parsed = schema.safeParse(data);

  if (!parsed.success) {
    await fetchTarkovDevData();
    return getData();
  }

  return parsed.data;
}
