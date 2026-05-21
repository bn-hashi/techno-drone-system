import { describe, it, expect } from "vitest";
import { parseCsv, CsvParseError } from "@/lib/csvParser";

describe("parseCsv", () => {
  const headers = [
    "subjectCode",
    "body",
    "choice1",
    "choice2",
    "choice3",
    "correctIndex",
    "explanation",
  ];

  it("test_parseCsv_parses_simple_row", () => {
    const csv = `subjectCode,body,choice1,choice2,choice3,correctIndex,explanation
SUBJECT_01,問1,A,B,C,1,解説`;

    const result = parseCsv(csv, headers);

    expect(result).toEqual([
      {
        subjectCode: "SUBJECT_01",
        body: "問1",
        choice1: "A",
        choice2: "B",
        choice3: "C",
        correctIndex: "1",
        explanation: "解説",
      },
    ]);
  });

  it("test_parseCsv_handles_multiple_rows", () => {
    const csv = `subjectCode,body,choice1,choice2,choice3,correctIndex,explanation
SUBJECT_01,問1,A,B,C,1,解説1
SUBJECT_02,問2,D,E,F,2,解説2`;

    const result = parseCsv(csv, headers);

    expect(result).toHaveLength(2);
  });

  it("test_parseCsv_handles_double_quoted_field_with_comma", () => {
    const csv = `subjectCode,body,choice1,choice2,choice3,correctIndex,explanation
SUBJECT_01,"問,1",A,B,C,1,解説`;

    const result = parseCsv(csv, headers);

    expect(result[0].body).toBe("問,1");
  });

  it("test_parseCsv_handles_escaped_double_quote", () => {
    const csv = `subjectCode,body,choice1,choice2,choice3,correctIndex,explanation
SUBJECT_01,"問""1""",A,B,C,1,解説`;

    const result = parseCsv(csv, headers);

    expect(result[0].body).toBe('問"1"');
  });

  it("test_parseCsv_handles_crlf_line_endings", () => {
    const csv =
      "subjectCode,body,choice1,choice2,choice3,correctIndex,explanation\r\nSUBJECT_01,問1,A,B,C,1,解説\r\n";

    const result = parseCsv(csv, headers);

    expect(result).toHaveLength(1);
  });

  it("test_parseCsv_throws_when_header_mismatch", () => {
    const csv = `wrong,headers
foo,bar`;

    expect(() => parseCsv(csv, headers)).toThrow(CsvParseError);
  });

  it("test_parseCsv_throws_when_column_count_mismatch", () => {
    const csv = `subjectCode,body,choice1,choice2,choice3,correctIndex,explanation
SUBJECT_01,問1,A,B,C`;

    expect(() => parseCsv(csv, headers)).toThrow(CsvParseError);
  });

  it("test_parseCsv_error_includes_line_number", () => {
    const csv = `subjectCode,body,choice1,choice2,choice3,correctIndex,explanation
SUBJECT_01,問1,A,B,C,1,OK
SUBJECT_02,問2,A,B`;

    let thrown: unknown;
    try {
      parseCsv(csv, headers);
    } catch (err) {
      thrown = err;
    }

    expect((thrown as CsvParseError).line).toBe(3);
  });

  it("test_parseCsv_ignores_trailing_empty_lines", () => {
    const csv = `subjectCode,body,choice1,choice2,choice3,correctIndex,explanation
SUBJECT_01,問1,A,B,C,1,解説

`;

    const result = parseCsv(csv, headers);

    expect(result).toHaveLength(1);
  });

  it("test_parseCsv_throws_when_empty_input", () => {
    expect(() => parseCsv("", headers)).toThrow(CsvParseError);
  });

  it("test_parseCsv_throws_when_quote_appears_mid_field", () => {
    // abc"def" のような不正クォート (フィールド先頭以外で開始) は拒否する
    const csv = `subjectCode,body,choice1,choice2,choice3,correctIndex,explanation
SUBJECT_01,abc"def",A,B,C,1,解説`;

    expect(() => parseCsv(csv, headers)).toThrow(CsvParseError);
  });

  it("test_parseCsv_throws_when_extra_chars_after_closing_quote", () => {
    // "abc"def のように閉じクォート後にカンマ/改行以外の文字がある場合も拒否
    const csv = `subjectCode,body,choice1,choice2,choice3,correctIndex,explanation
SUBJECT_01,"abc"def,A,B,C,1,解説`;

    expect(() => parseCsv(csv, headers)).toThrow(CsvParseError);
  });

  it("test_parseCsv_strips_utf8_bom_from_header", () => {
    // UTF-8 BOM (﻿) 付きヘッダーでも正常にパースする
    const csv = `﻿subjectCode,body,choice1,choice2,choice3,correctIndex,explanation
SUBJECT_01,問1,A,B,C,1,解説`;

    const result = parseCsv(csv, headers);

    expect(result).toHaveLength(1);
  });
});
