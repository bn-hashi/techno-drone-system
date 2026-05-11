import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUnlink } = vi.hoisted(() => ({
  mockUnlink: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  default: { unlink: mockUnlink },
  unlink: mockUnlink,
}));

vi.mock("@/lib/upload", () => ({
  UPLOAD_BASE_DIR: "/uploads",
}));

import { unlinkFile } from "@/lib/fsAdapter";

describe("unlinkFile", () => {
  beforeEach(() => {
    mockUnlink.mockReset();
  });

  it("test_unlinkFile_valid_path_calls_unlink_once", async () => {
    // Arrange
    mockUnlink.mockResolvedValue(undefined);

    // Act
    await unlinkFile("/uploads/photo.jpg");

    // Assert
    expect(mockUnlink).toHaveBeenCalledOnce();
  });

  it("test_unlinkFile_valid_path_calls_unlink_with_resolved_path", async () => {
    // Arrange
    mockUnlink.mockResolvedValue(undefined);

    // Act
    await unlinkFile("/uploads/photo.jpg");

    // Assert
    const calledWith = mockUnlink.mock.calls[0][0] as string;
    expect(calledWith).toContain("photo.jpg");
  });

  it("test_unlinkFile_path_outside_upload_dir_throws", async () => {
    // Act & Assert
    await expect(unlinkFile("/etc/passwd")).rejects.toThrow(
      "Attempted to delete file outside upload directory"
    );
    expect(mockUnlink).not.toHaveBeenCalled();
  });

  it("test_unlinkFile_path_traversal_attempt_throws", async () => {
    // Act & Assert
    await expect(unlinkFile("/uploads/../etc/passwd")).rejects.toThrow(
      "Attempted to delete file outside upload directory"
    );
    expect(mockUnlink).not.toHaveBeenCalled();
  });

  it("test_unlinkFile_root_path_throws", async () => {
    // Act & Assert
    await expect(unlinkFile("/")).rejects.toThrow(
      "Attempted to delete file outside upload directory"
    );
    expect(mockUnlink).not.toHaveBeenCalled();
  });
});
