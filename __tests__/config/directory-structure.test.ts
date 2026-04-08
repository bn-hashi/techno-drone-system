import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { resolve } from "path";

const projectRoot = resolve(__dirname, "../..");

const requiredDirs = [
  "app",
  "components",
  "hooks",
  "lib",
  "types",
  "services",
  "repositories",
];

describe("プロジェクトディレクトリ構造", () => {
  requiredDirs.forEach((dir) => {
    it(`test_directory_exists_${dir}`, () => {
      // Arrange
      const dirPath = resolve(projectRoot, dir);

      // Act / Assert
      expect(existsSync(dirPath)).toBe(true);
    });
  });
});
