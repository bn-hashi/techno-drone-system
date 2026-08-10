import { describe, it, expect } from "vitest";
import {
  dipsUaStatusLabel,
  dipsDeregistrationReasonLabel,
} from "@/lib/constants/dipsAircraftStatus";

describe("dipsUaStatusLabel", () => {
  it("test_dipsUaStatusLabel_returns_label_for_status_1_active", () => {
    expect(dipsUaStatusLabel(1)).toBe("有効");
  });

  it("test_dipsUaStatusLabel_returns_label_for_status_2_expired", () => {
    expect(dipsUaStatusLabel(2)).toBe("有効期限切れ");
  });

  it("test_dipsUaStatusLabel_returns_label_for_status_3_deregistered", () => {
    expect(dipsUaStatusLabel(3)).toBe("抹消済み");
  });

  it("test_dipsUaStatusLabel_falls_back_to_unknown_for_undefined_code", () => {
    // 修正2: クライアント側の寛容パース化に伴い、別紙1 未定義のコード値が
    // そのまま渡ってくる可能性がある。画面が壊れず「不明」にフォールバックすること。
    expect(dipsUaStatusLabel(99)).toBe("不明");
  });

  it("test_dipsUaStatusLabel_falls_back_to_unknown_for_null", () => {
    // 回帰テスト (A2 null 寛容化): aircraft_status が数値化できなかった機体は
    // null になる。画面が壊れず「不明」にフォールバックすること。
    expect(dipsUaStatusLabel(null)).toBe("不明");
  });
});

describe("dipsDeregistrationReasonLabel", () => {
  it("test_dipsDeregistrationReasonLabel_returns_label_for_reason_1", () => {
    // 回帰テスト (B5, CodeRabbit 指摘): 法令用語は「滅失」であり「減失」は誤字
    expect(dipsDeregistrationReasonLabel(1)).toBe("滅失・解体");
  });

  it("test_dipsDeregistrationReasonLabel_returns_label_for_reason_7", () => {
    expect(dipsDeregistrationReasonLabel(7)).toBe("更新登録が行われなかった");
  });

  it("test_dipsDeregistrationReasonLabel_falls_back_to_unknown_for_undefined_code", () => {
    expect(dipsDeregistrationReasonLabel(99)).toBe("不明");
  });
});
