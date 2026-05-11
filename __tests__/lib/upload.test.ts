// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";
import { BusinessError } from "@/services/errors";

// vi.hoisted で変数を事前宣言し、vi.mock のホイスト後も参照可能にする
const mockMkdir = vi.hoisted(() => vi.fn());
const mockWriteFile = vi.hoisted(() => vi.fn());
const mockRandomUUID = vi.hoisted(() => vi.fn(() => "test-uuid-1234"));
const mockFileTypeFromBuffer = vi.hoisted(() => vi.fn());

vi.mock("node:fs/promises", () => ({
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
}));

vi.mock("node:crypto", () => ({
  randomUUID: mockRandomUUID,
}));

vi.mock("file-type", () => ({
  fileTypeFromBuffer: mockFileTypeFromBuffer,
}));

import { saveUploadedFile, MAX_FILE_SIZE_BYTES, UPLOAD_BASE_DIR } from "@/lib/upload";

function createMockFile(name: string, type: string, sizeBytes: number): File {
  const buffer = new ArrayBuffer(sizeBytes);
  return new File([buffer], name, { type });
}

describe("saveUploadedFile", () => {
  beforeEach(() => {
    mockMkdir.mockReset();
    mockWriteFile.mockReset();
    mockFileTypeFromBuffer.mockReset();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    // デフォルトでは宣言された MIME タイプと一致するものを返す (各テストで上書き可能)
    mockFileTypeFromBuffer.mockResolvedValue({ mime: "image/jpeg", ext: "jpg" });
  });

  it("test_saveUploadedFile_valid_jpeg_returns_file_path", async () => {
    mockFileTypeFromBuffer.mockResolvedValue({ mime: "image/jpeg", ext: "jpg" });
    const file = createMockFile("photo.jpg", "image/jpeg", 1024);

    const result = await saveUploadedFile(file, "id-documents");

    expect(result).toBe(`${UPLOAD_BASE_DIR}id-documents/test-uuid-1234.jpg`);
  });

  it("test_saveUploadedFile_valid_png_returns_file_path", async () => {
    mockFileTypeFromBuffer.mockResolvedValue({ mime: "image/png", ext: "png" });
    const file = createMockFile("photo.png", "image/png", 1024);

    const result = await saveUploadedFile(file, "photos");

    expect(result).toBe(`${UPLOAD_BASE_DIR}photos/test-uuid-1234.png`);
  });

  it("test_saveUploadedFile_valid_pdf_returns_file_path", async () => {
    mockFileTypeFromBuffer.mockResolvedValue({ mime: "application/pdf", ext: "pdf" });
    const file = createMockFile("doc.pdf", "application/pdf", 1024);

    const result = await saveUploadedFile(file, "certificates");

    expect(result).toBe(`${UPLOAD_BASE_DIR}certificates/test-uuid-1234.pdf`);
  });

  it("test_saveUploadedFile_exceeds_max_size_throws_business_error", async () => {
    const oversizeBytes = MAX_FILE_SIZE_BYTES + 1;
    const file = createMockFile("large.jpg", "image/jpeg", oversizeBytes);

    await expect(saveUploadedFile(file, "docs")).rejects.toThrow(BusinessError);
  });

  it("test_saveUploadedFile_exceeds_max_size_throws_correct_message", async () => {
    const oversizeBytes = MAX_FILE_SIZE_BYTES + 1;
    const file = createMockFile("large.jpg", "image/jpeg", oversizeBytes);

    await expect(saveUploadedFile(file, "docs")).rejects.toThrow(
      "ファイルサイズが上限を超えています"
    );
  });

  it("test_saveUploadedFile_invalid_mime_type_throws_business_error", async () => {
    const file = createMockFile("script.sh", "application/x-sh", 100);

    await expect(saveUploadedFile(file, "docs")).rejects.toThrow(BusinessError);
  });

  it("test_saveUploadedFile_invalid_mime_type_throws_correct_message", async () => {
    const file = createMockFile("script.sh", "application/x-sh", 100);

    await expect(saveUploadedFile(file, "docs")).rejects.toThrow(
      "許可されていないファイル形式です"
    );
  });

  it("test_saveUploadedFile_empty_file_throws_business_error", async () => {
    const file = createMockFile("empty.jpg", "image/jpeg", 0);

    await expect(saveUploadedFile(file, "docs")).rejects.toThrow(BusinessError);
  });

  it("test_saveUploadedFile_empty_file_throws_correct_message", async () => {
    const file = createMockFile("empty.jpg", "image/jpeg", 0);

    await expect(saveUploadedFile(file, "docs")).rejects.toThrow("ファイルが空です");
  });

  it("test_saveUploadedFile_generates_unique_filename", async () => {
    const file = createMockFile("photo.jpg", "image/jpeg", 1024);

    const result = await saveUploadedFile(file, "photos");

    expect(result).toContain("test-uuid-1234");
    expect(result).not.toContain("photo.jpg");
  });

  it("test_saveUploadedFile_creates_subdirectory_if_not_exists", async () => {
    mockFileTypeFromBuffer.mockResolvedValue({ mime: "image/jpeg", ext: "jpg" });
    const file = createMockFile("photo.jpg", "image/jpeg", 1024);

    await saveUploadedFile(file, "id-documents");

    expect(mockMkdir).toHaveBeenCalledWith(`${UPLOAD_BASE_DIR}id-documents`, {
      recursive: true,
      mode: 0o700,
    });
  });

  it("test_saveUploadedFile_spoofed_mime_type_throws_business_error", async () => {
    // クライアントが image/jpeg と申告しているが実体は application/x-sh のケース
    mockFileTypeFromBuffer.mockResolvedValue({ mime: "application/x-sh", ext: "sh" });
    const file = createMockFile("evil.jpg", "image/jpeg", 1024);

    await expect(saveUploadedFile(file, "docs")).rejects.toThrow(BusinessError);
  });

  it("test_saveUploadedFile_spoofed_mime_type_throws_correct_message", async () => {
    mockFileTypeFromBuffer.mockResolvedValue({ mime: "application/x-sh", ext: "sh" });
    const file = createMockFile("evil.jpg", "image/jpeg", 1024);

    await expect(saveUploadedFile(file, "docs")).rejects.toThrow(
      "許可されていないファイル形式です"
    );
  });

  it("test_saveUploadedFile_undetectable_file_type_throws_business_error", async () => {
    // file-type がマジックバイトを認識できない場合
    mockFileTypeFromBuffer.mockResolvedValue(undefined);
    const file = createMockFile("unknown.jpg", "image/jpeg", 1024);

    await expect(saveUploadedFile(file, "docs")).rejects.toThrow(BusinessError);
  });
});
