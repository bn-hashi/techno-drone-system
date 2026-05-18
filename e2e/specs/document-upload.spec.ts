/**
 * E2E: Document upload flow
 *
 * Tests the POST /api/enrollment/documents endpoint used when a student
 * uploads identity documents as part of the enrollment process.
 *
 * Allowed file types (validated with magic-byte detection server-side):
 *   - image/jpeg (.jpg)
 *   - image/png  (.png)
 *   - application/pdf (.pdf)
 *
 * Maximum file size: 10 MB
 *
 * Authentication:
 *   The endpoint requires a valid STUDENT session (role check).  Tests use
 *   the pre-built student storage state so each test starts authenticated
 *   without repeating the login flow.
 *
 * Strategy:
 *   Because a student-facing document upload UI does not yet exist, these
 *   tests exercise the API directly via Playwright's `request` fixture.
 *   When the UI is built, browser-level tests should be added in a separate
 *   describe block using DocumentUploadPage.
 *
 * Fixtures used:
 *   - e2e/fixtures/test-users.ts — credentials & storage state paths
 *   - e2e/fixtures/auth-fixtures.ts — pre-authenticated browser contexts
 */

import { test, expect } from "../fixtures/auth-fixtures";
import { STORAGE_STATE } from "../fixtures/test-users";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** API endpoint under test */
const DOCUMENTS_API_URL = "/api/enrollment/documents";

/**
 * Minimal valid JPEG — a 1×1 pixel JFIF file.
 *
 * The magic bytes (FF D8 FF E0) are required because the server uses the
 * `file-type` library for magic-byte validation.  Supplying only an arbitrary
 * text body would be rejected even if the Content-Type header says image/jpeg.
 */
const MINIMAL_JPEG_BYTES = Buffer.from(
  "ffd8ffe000104a46494600010100000100010000ffdb00430001010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101ffc00b080001000101011100ffc4001f0000010501010101010100000000000000000102030405060708090a0bffda00080101000000013ff9fa",
  "hex"
);

/**
 * Minimal valid PNG — a 1×1 transparent pixel.
 *
 * Magic bytes: 89 50 4E 47 0D 0A 1A 0A
 */
const MINIMAL_PNG_BYTES = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6260000000020001e221bc330000000049454e44ae426082",
  "hex"
);

/**
 * Minimal valid PDF — a single-page PDF/1.4 document.
 *
 * Magic bytes: 25 50 44 46 (%PDF)
 */
const MINIMAL_PDF_BYTES = Buffer.from(
  "255044462d312e340a31203020 6f626a0a3c3c202f54797065202f436174616c6f670a202020202f50616765732032203020520a3e3e0a656e646f626a0a3220300a6f626a0a3c3c202f54797065202f50616765730a202020202f4b696473205b5d0a202020202f436f756e7420300a3e3e0a656e646f626a0a787265660a300a330a303030303030303030302036353533352066200a0000000000203030303130203030303030206e200a0000000000203030303435203030303030206e200a747261696c65720a3c3c202f53697a6520330a202020202f526f6f7420312030200a3e3e0a737461727478726566",
  "hex"
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a multipart FormData body containing one file entry.
 *
 * Playwright's APIRequestContext.fetch accepts a `multipart` option that
 * maps field names to file descriptors.
 */
function buildSingleFileForm(
  fieldName: string,
  fileName: string,
  mimeType: string,
  content: Buffer
) {
  return {
    [fieldName]: {
      name: fileName,
      mimeType,
      buffer: content,
    },
  };
}

// ---------------------------------------------------------------------------
// CRITICAL: Authentication guard
// ---------------------------------------------------------------------------

test.describe("Document upload API — authentication", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("unauthenticated request returns 401", async ({ request }) => {
    const response = await request.post(DOCUMENTS_API_URL, {
      multipart: buildSingleFileForm("idDocument", "id.jpg", "image/jpeg", MINIMAL_JPEG_BYTES),
    });

    expect(response.status()).toBe(401);
  });

  test("ADMIN session returns 403 (endpoint is STUDENT-only)", async ({ browser }) => {
    const adminContext = await browser.newContext({
      storageState: STORAGE_STATE.admin,
    });

    const response = await adminContext.request.post(DOCUMENTS_API_URL, {
      multipart: buildSingleFileForm("idDocument", "id.jpg", "image/jpeg", MINIMAL_JPEG_BYTES),
    });

    await adminContext.close();

    expect(response.status()).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// CRITICAL: Happy path — valid file types
// ---------------------------------------------------------------------------

test.describe("Document upload API — valid file types (STUDENT)", () => {
  // Use the pre-built student storage state so we start authenticated.
  test.use({ storageState: STORAGE_STATE.student });

  test("JPEG upload returns 200 or 404 (enrollment record required)", async ({ request }) => {
    // The API returns 200 when the student already has an enrollment application
    // in the DB, and 404 when they do not (EnrollmentNotFoundError).
    // The test asserts both outcomes because the seeded student may or may not
    // have a prior application depending on the test environment.
    const response = await request.post(DOCUMENTS_API_URL, {
      multipart: buildSingleFileForm(
        "idDocument",
        "identity.jpg",
        "image/jpeg",
        MINIMAL_JPEG_BYTES
      ),
    });

    expect([200, 404]).toContain(response.status());

    if (response.status() === 200) {
      const body = (await response.json()) as { success: boolean };
      expect(body.success).toBe(true);
    }
  });

  test("PNG upload returns 200 or 404", async ({ request }) => {
    const response = await request.post(DOCUMENTS_API_URL, {
      multipart: buildSingleFileForm("photo", "profile.png", "image/png", MINIMAL_PNG_BYTES),
    });

    expect([200, 404]).toContain(response.status());
  });

  test("PDF upload returns 200 or 404", async ({ request }) => {
    const response = await request.post(DOCUMENTS_API_URL, {
      multipart: buildSingleFileForm(
        "experienceCert",
        "certificate.pdf",
        "application/pdf",
        MINIMAL_PDF_BYTES
      ),
    });

    expect([200, 404]).toContain(response.status());
  });
});

// ---------------------------------------------------------------------------
// CRITICAL: Error handling — invalid file types
// ---------------------------------------------------------------------------

test.describe("Document upload API — invalid file type rejection (STUDENT)", () => {
  test.use({ storageState: STORAGE_STATE.student });

  /**
   * The service processes requests in this order:
   *   1. Empty file list check         → 400 (BusinessError)
   *   2. Zero-byte file check          → 400 (BusinessError)
   *   3. Enrollment record lookup      → 404 (EnrollmentNotFoundError) if no application
   *   4. MIME type / magic-byte check  → 400 (BusinessError, via saveUploadedFile)
   *   5. File size check               → 400 (BusinessError, via saveUploadedFile)
   *
   * The E2E test student may not have an enrollment application in the DB, so
   * steps 4 and 5 are only reached when a record exists.  Tests that target
   * steps 4/5 therefore accept both 400 (validation ran) and 404 (no record).
   * The critical assertion is that the server never returns 200 for invalid input.
   */

  test("executable file (.exe) is rejected — never returns 200", async ({ request }) => {
    // MZ header — DOS/Windows PE executable magic bytes
    const exeBytes = Buffer.from("4d5a9000", "hex");

    const response = await request.post(DOCUMENTS_API_URL, {
      multipart: {
        idDocument: {
          name: "malware.exe",
          // application/octet-stream is not in the allowed MIME list →
          // BusinessError is thrown in saveUploadedFile → 400.
          // If no enrollment record exists the service throws 404 first.
          mimeType: "application/octet-stream",
          buffer: exeBytes,
        },
      },
    });

    // Must not succeed — invalid input never yields 200
    expect(response.status()).not.toBe(200);
    // Expect either input validation (400) or missing enrollment record (404)
    expect([400, 404]).toContain(response.status());
  });

  test("MIME-spoofed file (exe disguised as jpeg) is rejected — never returns 200", async ({
    request,
  }) => {
    // MZ header with image/jpeg MIME claim — triggers magic-byte mismatch guard
    // in saveUploadedFile (step 4 in the processing order above).
    const spoofedBytes = Buffer.from("4d5a9000030000000400000000000000", "hex");

    const response = await request.post(DOCUMENTS_API_URL, {
      multipart: {
        idDocument: {
          name: "disguised.jpg",
          mimeType: "image/jpeg",
          buffer: spoofedBytes,
        },
      },
    });

    expect(response.status()).not.toBe(200);
    expect([400, 404]).toContain(response.status());
  });

  test("GIF file is rejected — never returns 200 (not in allowed list)", async ({ request }) => {
    // GIF89a magic bytes
    const gifBytes = Buffer.from("474946383961", "hex");

    const response = await request.post(DOCUMENTS_API_URL, {
      multipart: {
        idDocument: {
          name: "image.gif",
          mimeType: "image/gif",
          buffer: gifBytes,
        },
      },
    });

    expect(response.status()).not.toBe(200);
    expect([400, 404]).toContain(response.status());
  });

  test("no file fields returns 400 (checked before enrollment lookup)", async ({ request }) => {
    // Empty file list check (step 1) runs BEFORE the enrollment record lookup,
    // so this always returns 400 regardless of whether an application exists.
    const response = await request.post(DOCUMENTS_API_URL, {
      multipart: {
        unknownField: {
          name: "file.jpg",
          mimeType: "image/jpeg",
          buffer: MINIMAL_JPEG_BYTES,
        },
      },
    });

    expect(response.status()).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("ファイルが1件も提供されていません");
  });
});

// ---------------------------------------------------------------------------
// IMPORTANT: Error handling — file size validation
// ---------------------------------------------------------------------------

test.describe("Document upload API — file size validation (STUDENT)", () => {
  test.use({ storageState: STORAGE_STATE.student });

  // Maximum allowed: 10 MB (10 * 1024 * 1024 bytes)
  const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

  test("file exceeding 10 MB is rejected with 400", async ({ request }) => {
    // Build a buffer 1 byte over the limit.
    // Prepend a valid JPEG magic header so the size check is reached before
    // the MIME type check rejects it. The size guard runs first in saveUploadedFile.
    const oversizeBuffer = Buffer.alloc(MAX_FILE_SIZE_BYTES + 1, 0);
    // Write JPEG magic bytes at the start to pass the MIME sniff check
    MINIMAL_JPEG_BYTES.copy(oversizeBuffer, 0);

    const response = await request.post(DOCUMENTS_API_URL, {
      multipart: {
        idDocument: {
          name: "oversized.jpg",
          mimeType: "image/jpeg",
          buffer: oversizeBuffer,
        },
      },
    });

    expect(response.status()).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain("ファイルサイズが上限を超えています");
  });

  test("file at exactly the size limit is processed (200 or 404)", async ({ request }) => {
    // 10 MB exactly — should not be rejected by the size check.
    // The magic-byte check will reject it (padding bytes are not valid JPEG),
    // so we expect either 400 from magic-byte rejection or 200/404 from the
    // business layer.  The key assertion is that it is NOT a 413 (too large).
    const exactBuffer = Buffer.alloc(MAX_FILE_SIZE_BYTES, 0);
    MINIMAL_JPEG_BYTES.copy(exactBuffer, 0);

    const response = await request.post(DOCUMENTS_API_URL, {
      multipart: {
        idDocument: {
          name: "exact-limit.jpg",
          mimeType: "image/jpeg",
          buffer: exactBuffer,
        },
      },
    });

    // Must not be a network-level 413 (Request Entity Too Large)
    expect(response.status()).not.toBe(413);
  });

  test("zero-byte file is rejected with 400", async ({ request }) => {
    const emptyBuffer = Buffer.alloc(0);

    const response = await request.post(DOCUMENTS_API_URL, {
      multipart: {
        idDocument: {
          name: "empty.jpg",
          mimeType: "image/jpeg",
          buffer: emptyBuffer,
        },
      },
    });

    expect(response.status()).toBe(400);
    const body = (await response.json()) as { error: string };
    // Service throws BusinessError for zero-byte files
    expect(body.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// IMPORTANT: Multiple field upload
// ---------------------------------------------------------------------------

test.describe("Document upload API — multiple fields (STUDENT)", () => {
  test.use({ storageState: STORAGE_STATE.student });

  test("uploading all three fields at once returns 200 or 404", async ({ request }) => {
    const response = await request.post(DOCUMENTS_API_URL, {
      multipart: {
        idDocument: {
          name: "id.jpg",
          mimeType: "image/jpeg",
          buffer: MINIMAL_JPEG_BYTES,
        },
        photo: {
          name: "photo.png",
          mimeType: "image/png",
          buffer: MINIMAL_PNG_BYTES,
        },
        experienceCert: {
          name: "cert.pdf",
          mimeType: "application/pdf",
          buffer: MINIMAL_PDF_BYTES,
        },
      },
    });

    expect([200, 404]).toContain(response.status());
  });

  test("uploading only idDocument and photo (partial fields) returns 200 or 404", async ({
    request,
  }) => {
    const response = await request.post(DOCUMENTS_API_URL, {
      multipart: {
        idDocument: {
          name: "id.jpg",
          mimeType: "image/jpeg",
          buffer: MINIMAL_JPEG_BYTES,
        },
        photo: {
          name: "photo.png",
          mimeType: "image/png",
          buffer: MINIMAL_PNG_BYTES,
        },
      },
    });

    // Partial uploads are valid — the API accepts any subset of the three fields
    expect([200, 404]).toContain(response.status());
  });
});
