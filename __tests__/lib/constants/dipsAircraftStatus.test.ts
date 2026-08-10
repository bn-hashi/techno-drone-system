import { describe, it, expect } from "vitest";
import {
  dipsUaStatusLabel,
  dipsDeregistrationReasonLabel,
} from "@/lib/constants/dipsAircraftStatus";

describe("dipsUaStatusLabel", () => {
  it("test_dipsUaStatusLabel_returns_known_label_for_defined_code", () => {
    expect(dipsUaStatusLabel(1)).toBe("有効");
    expect(dipsUaStatusLabel(2)).toBe("有効期限切れ");
    expect(dipsUaStatusLabel(3)).toBe("抹消済み");
  });

  it("test_dipsUaStatusLabel_falls_back_to_unknown_for_undefined_code", () => {
    // 修正2: クライアント側の寛容パース化に伴い、別紙1 未定義のコード値が
    // そのまま渡ってくる可能性がある。画面が壊れず「不明」にフォールバックすること。
    expect(dipsUaStatusLabel(99)).toBe("不明");
  });
});

describe("dipsDeregistrationReasonLabel", () => {
  it("test_dipsDeregistrationReasonLabel_returns_known_label_for_defined_code", () => {
    expect(dipsDeregistrationReasonLabel(1)).toBe("減失・解体");
    expect(dipsDeregistrationReasonLabel(7)).toBe("更新登録が行われなかった");
  });

  it("test_dipsDeregistrationReasonLabel_falls_back_to_unknown_for_undefined_code", () => {
    expect(dipsDeregistrationReasonLabel(99)).toBe("不明");
  });
});
