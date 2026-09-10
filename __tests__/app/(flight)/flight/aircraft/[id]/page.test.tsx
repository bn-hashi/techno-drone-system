import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { UserRole } from "@/types/prisma";
import type { AircraftDto } from "@/lib/api/aircraft";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/serviceFactory", () => ({
  getAircraftService: vi.fn(),
}));
vi.mock("@/app/(flight)/flight/aircraft/[id]/DeactivateButton", () => ({
  DeactivateButton: ({ aircraftId }: { aircraftId: string }) => (
    <button data-testid="deactivate-button" data-aircraft-id={aircraftId}>
      廃止
    </button>
  ),
}));
vi.mock("@/app/(flight)/flight/aircraft/[id]/DipsVerifyButton", () => ({
  DipsVerifyButton: () => <div data-testid="dips-verify-button" />,
}));

import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getAircraftService } from "@/lib/serviceFactory";
import { AircraftNotFoundError } from "@/services/errors";
import AircraftDetailPage from "@/app/(flight)/flight/aircraft/[id]/page";

const mockFindById = vi.fn();

const pilotSession = {
  user: { id: "user-1", role: UserRole.PILOT },
};

const makeAircraft = (overrides: Partial<AircraftDto> = {}): AircraftDto => ({
  id: "aircraft-1",
  userId: "user-1",
  name: "テスト機体",
  manufacturer: "テストメーカー",
  modelNumber: "T-1",
  serialNumber: "SN-1",
  weightGrams: 900,
  maxFlightTimeMin: 20,
  registrationNumber: "JU1234567890",
  isActive: true,
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-01T00:00:00.000Z",
  dipsUaType: null,
  hasDipsCertification1: false,
  hasDipsCertification2: false,
  dipsCertificationNumber: null,
  maxTakeoffWeightGrams: null,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAircraftService).mockReturnValue({
    findById: mockFindById,
  } as unknown as ReturnType<typeof getAircraftService>);
});

afterEach(() => {
  cleanup();
});

describe("AircraftDetailPage", () => {
  it("test_unauthenticated_redirects_to_login", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    await expect(AircraftDetailPage({ params: { id: "a-1" } })).rejects.toThrow(
      "NEXT_REDIRECT:/login"
    );
  });

  it("test_non_flight_role_calls_redirect", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: "u-1", role: UserRole.STUDENT },
    });

    await AircraftDetailPage({ params: { id: "a-1" } }).catch(() => {});

    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("test_not_found_when_aircraft_does_not_exist", async () => {
    vi.mocked(getServerSession).mockResolvedValue(pilotSession);
    mockFindById.mockRejectedValue(new AircraftNotFoundError("a-1"));

    await expect(AircraftDetailPage({ params: { id: "a-1" } })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  describe("DIPS機体の種類の表示 (req-013 差し戻し J6)", () => {
    it("test_shows_an_actionable_message_when_dips_ua_type_is_not_set", async () => {
      vi.mocked(getServerSession).mockResolvedValue(pilotSession);
      mockFindById.mockResolvedValue(makeAircraft({ dipsUaType: null }));

      const page = await AircraftDetailPage({ params: { id: "aircraft-1" } });
      render(page as React.ReactElement);

      // 「不明」(範囲外コードと同じ表示) ではなく、未設定であることと対応が
      // 必要なことが分かる文言を表示する (隣の最大離陸重量と同じ水準)
      expect(screen.getByText("未設定（DIPS通報前に設定が必要）")).toBeInTheDocument();
      expect(screen.queryByText("不明")).not.toBeInTheDocument();
    });

    it("test_shows_the_label_when_dips_ua_type_is_set", async () => {
      vi.mocked(getServerSession).mockResolvedValue(pilotSession);
      mockFindById.mockResolvedValue(makeAircraft({ dipsUaType: 2 }));

      const page = await AircraftDetailPage({ params: { id: "aircraft-1" } });
      render(page as React.ReactElement);

      expect(screen.getByText("回転翼航空機（ヘリコプター）")).toBeInTheDocument();
    });
  });

  it("test_shows_the_aircraft_name", async () => {
    vi.mocked(getServerSession).mockResolvedValue(pilotSession);
    mockFindById.mockResolvedValue(makeAircraft());

    const page = await AircraftDetailPage({ params: { id: "aircraft-1" } });
    render(page as React.ReactElement);

    expect(screen.getAllByText("テスト機体").length).toBeGreaterThan(0);
  });
});
