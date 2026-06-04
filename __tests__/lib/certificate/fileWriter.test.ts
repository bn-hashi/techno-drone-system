import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const { mockMkdir, mockWriteFile } = vi.hoisted(() => ({
  mockMkdir: vi.fn(),
  mockWriteFile: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  default: { mkdir: mockMkdir, writeFile: mockWriteFile },
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
}));

import { LocalFsCertificateFileWriter } from "@/lib/certificate/fileWriter";

describe("LocalFsCertificateFileWriter", () => {
  const ORIGINAL_ENV = process.env;
  let writer: LocalFsCertificateFileWriter;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.CERTIFICATE_OUTPUT_DIR;
    mockMkdir.mockReset();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockReset();
    mockWriteFile.mockResolvedValue(undefined);
    writer = new LocalFsCertificateFileWriter();
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("test_write_uses_default_dir_when_env_unset", async () => {
    // Act
    const result = await writer.write("第TC051526050001号", Buffer.from("PDF"));

    // Assert
    expect(result).toMatch(/^\/home\/ubuntu\/uploads\/certificates\//);
  });

  it("test_write_uses_env_dir_when_set", async () => {
    // Arrange
    process.env.CERTIFICATE_OUTPUT_DIR = "/tmp/certs";

    // Act
    const result = await writer.write("第TC051526050001号", Buffer.from("PDF"));

    // Assert
    expect(result).toMatch(/^\/tmp\/certs\//);
  });

  it("test_write_creates_directory_recursively", async () => {
    // Arrange
    process.env.CERTIFICATE_OUTPUT_DIR = "/tmp/certs";

    // Act
    await writer.write("第TC051526050001号", Buffer.from("PDF"));

    // Assert
    expect(mockMkdir).toHaveBeenCalledWith("/tmp/certs", { recursive: true });
  });

  it("test_write_sanitizes_filename_to_ascii_only", async () => {
    // Arrange
    process.env.CERTIFICATE_OUTPUT_DIR = "/tmp/certs";

    // Act
    const result = await writer.write("第TC051526050001号", Buffer.from("PDF"));

    // Assert: 日本語 (第・号) は除去され、英数字のみのファイル名
    expect(result).toBe("/tmp/certs/TC051526050001.pdf");
  });

  it("test_write_passes_buffer_to_writeFile", async () => {
    // Arrange
    process.env.CERTIFICATE_OUTPUT_DIR = "/tmp/certs";
    const buf = Buffer.from("PDF DATA");

    // Act
    await writer.write("第TC051526050001号", buf);

    // Assert
    expect(mockWriteFile).toHaveBeenCalledWith("/tmp/certs/TC051526050001.pdf", buf);
  });

  it("test_write_returns_absolute_path", async () => {
    // Arrange
    process.env.CERTIFICATE_OUTPUT_DIR = "/tmp/certs";

    // Act
    const result = await writer.write("第TC051526050001号", Buffer.from("PDF"));

    // Assert: path.resolve により絶対パスが返る
    expect(result.startsWith("/")).toBe(true);
  });
});
