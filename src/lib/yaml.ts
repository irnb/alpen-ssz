import yaml from "js-yaml";

function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

export function dumpYaml(input: unknown): string {
  return yaml.dump(JSON.parse(JSON.stringify(input, bigintReplacer)));
}

export function parseYaml(input: string): unknown {
  return yaml.load(input);
}
