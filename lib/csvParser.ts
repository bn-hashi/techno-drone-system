/**
 * 軽量 CSV パーサ
 *
 * RFC 4180 のサブセットを実装：
 * - カンマ区切り
 * - ヘッダー行必須
 * - フィールドはダブルクォートで囲める ("foo,bar")
 * - クォート内のダブルクォートは "" でエスケープ
 * - 改行は \n または \r\n
 *
 * 外部ライブラリ依存を避けるため自前実装。問題バンク CSV インポート用に
 * 列数固定 (ヘッダー一致) で十分。
 */

export class CsvParseError extends Error {
  readonly line: number;

  constructor(message: string, line: number) {
    super(`CSV パースエラー (line ${line}): ${message}`);
    this.name = "CsvParseError";
    this.line = line;
  }
}

interface ParsedLine {
  fields: string[];
  lineNumber: number;
}

function parseLine(
  input: string,
  startIndex: number,
  lineNumber: number
): { line: ParsedLine; nextIndex: number } {
  const fields: string[] = [];
  let i = startIndex;
  let current = "";
  let inQuotes = false;
  // フィールド先頭以外でクォートが現れる、または閉じクォート後に
  // カンマ/改行以外の文字が続く不正パターンを検知するためのフラグ
  let fieldStarted = false;
  let justClosedQuote = false;

  while (i < input.length) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          // エスケープされたダブルクォート
          current += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        justClosedQuote = true;
        i += 1;
        continue;
      }
      current += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      if (fieldStarted) {
        // フィールド先頭以外でクォートが開始した (例: abc"def" や "a"b)
        throw new CsvParseError("クォートはフィールド先頭でしか開始できません", lineNumber);
      }
      inQuotes = true;
      fieldStarted = true;
      i += 1;
      continue;
    }

    if (ch === ",") {
      fields.push(current);
      current = "";
      fieldStarted = false;
      justClosedQuote = false;
      i += 1;
      continue;
    }

    if (ch === "\n" || ch === "\r") {
      fields.push(current);
      // \r\n を 1 行として扱う
      const next = ch === "\r" && input[i + 1] === "\n" ? i + 2 : i + 1;
      return { line: { fields, lineNumber }, nextIndex: next };
    }

    if (justClosedQuote) {
      // 閉じクォートの直後に区切り (カンマ / 改行) 以外の文字が続いた (例: "abc"def)
      throw new CsvParseError(
        "クォートで囲ったフィールドの後ろにカンマ・改行以外を置けません",
        lineNumber
      );
    }

    current += ch;
    fieldStarted = true;
    i += 1;
  }

  if (inQuotes) {
    throw new CsvParseError("ダブルクォートが閉じられていません", lineNumber);
  }

  fields.push(current);
  return { line: { fields, lineNumber }, nextIndex: i };
}

export function parseCsv(
  input: string,
  expectedHeaders: readonly string[]
): Record<string, string>[] {
  if (input.trim() === "") {
    throw new CsvParseError("空の CSV です", 1);
  }

  // UTF-8 BOM (﻿) を除去する。Excel 等が付与するため、付いていてもヘッダー一致を許容する
  if (input.charCodeAt(0) === 0xfeff) {
    input = input.slice(1);
  }

  let index = 0;
  let lineNumber = 1;

  // ヘッダー行
  const headerResult = parseLine(input, index, lineNumber);
  const headers = headerResult.line.fields;
  index = headerResult.nextIndex;
  lineNumber += 1;

  if (headers.length !== expectedHeaders.length) {
    throw new CsvParseError(
      `ヘッダー列数が一致しません (expected: ${expectedHeaders.length}, got: ${headers.length})`,
      1
    );
  }
  for (let i = 0; i < expectedHeaders.length; i += 1) {
    if (headers[i] !== expectedHeaders[i]) {
      throw new CsvParseError(
        `ヘッダー名が一致しません (expected: ${expectedHeaders[i]}, got: ${headers[i]})`,
        1
      );
    }
  }

  const result: Record<string, string>[] = [];
  while (index < input.length) {
    const dataResult = parseLine(input, index, lineNumber);
    index = dataResult.nextIndex;

    // 完全に空の行はスキップ (末尾改行への対応)
    const isEmpty = dataResult.line.fields.length === 1 && dataResult.line.fields[0] === "";
    if (!isEmpty) {
      if (dataResult.line.fields.length !== expectedHeaders.length) {
        throw new CsvParseError(
          `列数が一致しません (expected: ${expectedHeaders.length}, got: ${dataResult.line.fields.length})`,
          lineNumber
        );
      }
      const record: Record<string, string> = {};
      for (let i = 0; i < expectedHeaders.length; i += 1) {
        record[expectedHeaders[i]] = dataResult.line.fields[i];
      }
      result.push(record);
    }
    lineNumber += 1;
  }

  return result;
}
