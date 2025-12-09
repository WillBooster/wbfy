import fs from 'node:fs';
import path from 'node:path';

import merge from 'deepmerge';
import ts from 'typescript';

import { logger } from '../logger.js';
import type { PackageConfig } from '../packageConfig.js';
import { fsUtil } from '../utils/fsUtil.js';
import { promisePool } from '../utils/promisePool.js';

type ParsedValue =
  | { kind: 'array'; value: ParsedValue[] }
  | { kind: 'literal'; value: string }
  | { kind: 'object'; value: ParsedObject };
type ParsedObject = Record<string, ParsedValue>;

const literal = (value: string): ParsedValue => ({ kind: 'literal', value });
const asArray = (value: ParsedValue[]): ParsedValue => ({ kind: 'array', value });
const asObject = (value: ParsedObject): ParsedValue => ({ kind: 'object', value });

const defaultConfig: ParsedObject = {
  forbidOnly: literal('!!process.env.CI'),
  retries: literal('process.env.PWDEBUG ? 0 : process.env.CI ? 5 : 1'),
  use: asObject({
    baseURL: literal('process.env.NEXT_PUBLIC_BASE_URL'),
    trace: literal("process.env.CI ? 'on-first-retry' : 'retain-on-failure'"),
    screenshot: literal("process.env.CI ? 'only-on-failure' : 'only-on-failure'"),
    video: literal("process.env.CI ? 'retain-on-failure' : 'retain-on-failure'"),
  }),
  webServer: asObject({
    command: literal("'yarn start-test-server'"),
    url: literal('process.env.NEXT_PUBLIC_BASE_URL'),
    reuseExistingServer: literal('!!process.env.CI'),
    timeout: literal('300_000'),
    stdout: literal("'ignore'"),
    stderr: literal("'pipe'"),
    env: literal(`{
  ...process.env,
  PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: 'true',
}`),
    gracefulShutdown: literal(`{
  signal: 'SIGTERM',
  timeout: 500,
}`),
  }),
};

export async function fixPlaywrightConfig(config: PackageConfig): Promise<void> {
  return logger.functionIgnoringException('fixPlaywrightConfig', async () => {
    const filePath = path.resolve(config.dirPath, `playwright.config.ts`);
    if (!fs.existsSync(filePath)) return;

    const oldContent = await fs.promises.readFile(filePath, 'utf8');
    const match = /defineConfig\s*\(\s*(\{[\s\S]*?})\s*\);?/.exec(oldContent);
    const objectLiteral = match?.[1];
    if (!objectLiteral) return;

    const parsed = parseObjectLiteral(objectLiteral);
    if (!parsed) return;

    const merged = merge.all<ParsedObject>([defaultConfig, parsed, defaultConfig]);
    const newObjectLiteral = stringifyObject(merged, 0);
    const newContent = oldContent.replace(objectLiteral, newObjectLiteral);

    await promisePool.run(() => fsUtil.generateFile(filePath, newContent));
  });
}

function parseObjectLiteral(objectLiteral: string): ParsedObject | undefined {
  const source = ts.createSourceFile(
    'playwright-config.ts',
    `const config = ${objectLiteral};`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const statement = source.statements[0];
  if (!statement || !ts.isVariableStatement(statement)) return;
  const declaration = statement.declarationList.declarations[0];
  if (!declaration?.initializer || !ts.isObjectLiteralExpression(declaration.initializer)) return;
  return parseObjectLiteralExpression(declaration.initializer, source);
}

function parseObjectLiteralExpression(
  objectLiteral: ts.ObjectLiteralExpression,
  source: ts.SourceFile
): ParsedObject | undefined {
  const parsed: ParsedObject = {};
  for (const property of objectLiteral.properties) {
    if (!ts.isPropertyAssignment(property) || (!ts.isIdentifier(property.name) && !ts.isStringLiteral(property.name))) {
      return;
    }
    const value = parseExpression(property.initializer, source);
    if (value === undefined) return;
    parsed[property.name.getText(source)] = value;
  }
  return parsed;
}

function parseExpression(expression: ts.Expression, source: ts.SourceFile): ParsedValue | undefined {
  if (ts.isObjectLiteralExpression(expression)) {
    const parsedObject = parseObjectLiteralExpression(expression, source);
    return parsedObject ? asObject(parsedObject) : literal(expression.getText(source));
  }
  if (ts.isArrayLiteralExpression(expression)) {
    const elements = expression.elements.map((element) => parseExpression(element, source));
    if (elements.some((element): element is undefined => element === undefined)) {
      return literal(expression.getText(source));
    }
    return asArray(elements as ParsedValue[]);
  }
  return literal(expression.getText(source));
}

function stringifyValue(value: ParsedValue, level: number): string {
  if (value.kind === 'array') {
    return stringifyArray(value.value, level);
  }
  if (value.kind === 'literal') return value.value;
  return stringifyObject(value.value, level);
}

function stringifyArray(values: ParsedValue[], level: number): string {
  if (values.length === 0) return '[]';
  const indent = '  '.repeat(level + 1);
  const lines = values.map((value) => {
    const stringified = stringifyValue(value, level + 1).split('\n');
    stringified[stringified.length - 1] = `${stringified.at(-1)},`;
    if (value.kind === 'literal') {
      for (let index = 1; index < stringified.length; index += 1) {
        stringified[index] = `${indent}${stringified[index]}`;
      }
    }
    stringified[0] = `${indent}${stringified[0]}`;
    return stringified.join('\n');
  });
  const closingIndent = '  '.repeat(level);
  return `[\n${lines.join('\n')}\n${closingIndent}]`;
}

function stringifyObject(object: ParsedObject, level: number): string {
  const indent = '  '.repeat(level + 1);
  const lines = Object.entries(object).map(([key, value]) => {
    const stringified = stringifyValue(value, level + 1).split('\n');
    stringified[stringified.length - 1] = `${stringified.at(-1)},`;
    if (value.kind === 'literal') {
      for (let index = 1; index < stringified.length; index += 1) {
        stringified[index] = `${indent}${stringified[index]}`;
      }
    }
    stringified[0] = `${indent}${key}: ${stringified[0]}`;
    return stringified.join('\n');
  });
  const closingIndent = '  '.repeat(level);
  if (lines.length === 0) return `{\n${closingIndent}}`;
  return `{\n${lines.join('\n')}\n${closingIndent}}`;
}
