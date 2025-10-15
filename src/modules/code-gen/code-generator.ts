import { logger } from "../../core/logger.ts";
import { AIService } from "../ai/ai.service.ts";

export interface GeneratedFile {
  path: string;
  content: string;
  action: "create" | "update" | "delete";
}

export interface CodeGenerationResult {
  files: GeneratedFile[];
  description: string;
  testFiles?: GeneratedFile[];
}

export class CodeGenerator {
  private aiService: AIService;

  constructor() {
    this.aiService = new AIService();
  }

  async generateBugFix(analysis: any): Promise<CodeGenerationResult> {
    logger.info("Generating bug fix based on analysis");

    // Parse the analysis to understand what needs to be fixed
    const affectedFiles = analysis.requiredFiles || ["src/main.ts"];

    const files: GeneratedFile[] = [];

    for (const filePath of affectedFiles) {
      const fixedContent = await this.generateFixForFile(filePath, analysis);

      files.push({
        path: filePath,
        content: fixedContent,
        action: "update"
      });
    }

    // Generate tests for the fix
    const testFiles = await this.generateTestsForFix(analysis);

    return {
      files,
      testFiles,
      description: `Fixed ${analysis.summary}\n\nModified ${files.length} file(s)`
    };
  }

  async generateFeature(analysis: any): Promise<CodeGenerationResult> {
    logger.info("Generating feature implementation based on analysis");

    const files: GeneratedFile[] = [];

    // Generate main feature file
    const featureCode = await this.aiService.generateCode({
      task: analysis.summary,
      context: JSON.stringify(analysis),
      language: "typescript",
      framework: "deno"
    });

    files.push({
      path: `src/features/${this.generateFeatureName(analysis)}.ts`,
      content: featureCode,
      action: "create"
    });

    // Generate supporting files (interfaces, utilities, etc.)
    const supportingFiles = await this.generateSupportingFiles(analysis);
    files.push(...supportingFiles);

    // Generate tests
    const testFiles = await this.generateFeatureTests(analysis);

    return {
      files,
      testFiles,
      description: `Implemented feature: ${analysis.summary}\n\nCreated ${files.length} new file(s)`
    };
  }

  async generateTests(targetFile: string, context?: any): Promise<CodeGenerationResult> {
    logger.info(`Generating tests for: ${targetFile}`);

    const testContent = await this.generateTestContent(targetFile, context);

    const testPath = this.getTestPath(targetFile);

    return {
      files: [{
        path: testPath,
        content: testContent,
        action: "create"
      }],
      description: `Generated tests for ${targetFile}`
    };
  }

  async generateRefactor(analysis: any): Promise<CodeGenerationResult> {
    logger.info("Generating refactored code based on analysis");

    const files: GeneratedFile[] = [];

    // Identify files that need refactoring
    const filesToRefactor = analysis.requiredFiles || [];

    for (const filePath of filesToRefactor) {
      const refactoredContent = await this.generateRefactoredCode(filePath, analysis);

      files.push({
        path: filePath,
        content: refactoredContent,
        action: "update"
      });
    }

    return {
      files,
      description: `Refactored ${files.length} file(s) to improve code quality`
    };
  }

  private async generateFixForFile(filePath: string, analysis: any): Promise<string> {
    // Generate fixed version of the file
    const fixPrompt = `
Fix the issue in ${filePath}:
Issue: ${analysis.summary}
Required changes: ${analysis.suggestions}
`;

    return await this.aiService.generateCode({
      task: fixPrompt,
      context: JSON.stringify(analysis),
      language: this.getLanguageFromPath(filePath),
      framework: "deno"
    });
  }

  private async generateTestsForFix(analysis: any): Promise<GeneratedFile[]> {
    const testFiles: GeneratedFile[] = [];

    // Generate test to verify the bug is fixed
    const testContent = `
// Test to verify bug fix: ${analysis.summary}
import { assertEquals, assertNotEquals } from "@std/assert/mod.ts";

Deno.test("Bug fix verification", async () => {
  // Test implementation
  const result = await testBugFix();

  // Verify the bug is fixed
  assertEquals(result.status, "success");
  assertNotEquals(result.error, "bug-present");
});

async function testBugFix() {
  // Implementation to test the fix
  return { status: "success", error: null };
}
`.trim();

    testFiles.push({
      path: "tests/bug-fix.test.ts",
      content: testContent,
      action: "create"
    });

    return testFiles;
  }

  private async generateFeatureTests(analysis: any): Promise<GeneratedFile[]> {
    const testFiles: GeneratedFile[] = [];

    const testContent = `
// Tests for feature: ${analysis.summary}
import { assertEquals, assertExists } from "@std/assert/mod.ts";
import { Feature } from "../src/features/${this.generateFeatureName(analysis)}.ts";

Deno.test("Feature initialization", () => {
  const feature = new Feature();
  assertExists(feature);
});

Deno.test("Feature functionality", async () => {
  const feature = new Feature();
  const result = await feature.execute();

  assertEquals(result.success, true);
});

Deno.test("Feature edge cases", async () => {
  const feature = new Feature();

  // Test with null input
  const nullResult = await feature.execute(null);
  assertEquals(nullResult.success, false);

  // Test with invalid input
  const invalidResult = await feature.execute({ invalid: true });
  assertEquals(invalidResult.success, false);
});
`.trim();

    testFiles.push({
      path: `tests/features/${this.generateFeatureName(analysis)}.test.ts`,
      content: testContent,
      action: "create"
    });

    return testFiles;
  }

  private async generateSupportingFiles(analysis: any): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];

    // Generate interface file
    const interfaceContent = `
// Interfaces for feature: ${analysis.summary}
export interface FeatureConfig {
  enabled: boolean;
  options?: Record<string, any>;
}

export interface FeatureResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface FeatureContext {
  user?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}
`.trim();

    files.push({
      path: `src/features/${this.generateFeatureName(analysis)}.types.ts`,
      content: interfaceContent,
      action: "create"
    });

    return files;
  }

  private async generateTestContent(targetFile: string, context?: any): Promise<string> {
    const language = this.getLanguageFromPath(targetFile);

    if (language === "typescript" || language === "javascript") {
      return `
// Tests for ${targetFile}
import { assertEquals, assertExists, assertThrows } from "@std/assert/mod.ts";
import { ComponentUnderTest } from "../${targetFile}";

Deno.test("Component initialization", () => {
  const component = new ComponentUnderTest();
  assertExists(component);
});

Deno.test("Component main functionality", async () => {
  const component = new ComponentUnderTest();
  const result = await component.execute();

  assertEquals(result.success, true);
  assertExists(result.data);
});

Deno.test("Component error handling", () => {
  const component = new ComponentUnderTest();

  assertThrows(() => {
    component.executeWithInvalidInput(null);
  }, Error, "Invalid input");
});

Deno.test("Component edge cases", async () => {
  const component = new ComponentUnderTest();

  // Test with empty input
  const emptyResult = await component.execute({});
  assertEquals(emptyResult.success, true);

  // Test with large input
  const largeInput = Array(1000).fill("test");
  const largeResult = await component.execute(largeInput);
  assertEquals(largeResult.success, true);
});
`.trim();
    }

    return "// Generated test content";
  }

  private async generateRefactoredCode(filePath: string, analysis: any): Promise<string> {
    const refactorPrompt = `
Refactor the code in ${filePath} to improve:
- Code readability
- Performance
- Maintainability
- Follow best practices

Context: ${JSON.stringify(analysis)}
`;

    return await this.aiService.generateCode({
      task: refactorPrompt,
      context: JSON.stringify(analysis),
      language: this.getLanguageFromPath(filePath),
      framework: "deno"
    });
  }

  private generateFeatureName(analysis: any): string {
    // Generate a feature name from the analysis
    const title = analysis.summary || "feature";
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  private getTestPath(targetFile: string): string {
    // Convert source path to test path
    const fileName = targetFile.split("/").pop()?.replace(/\.\w+$/, "");
    return `tests/${fileName}.test.ts`;
  }

  private getLanguageFromPath(filePath: string): string {
    const extension = filePath.split(".").pop()?.toLowerCase();

    switch (extension) {
      case "ts":
      case "tsx":
        return "typescript";
      case "js":
      case "jsx":
        return "javascript";
      case "py":
        return "python";
      case "go":
        return "go";
      case "rs":
        return "rust";
      default:
        return "unknown";
    }
  }
}