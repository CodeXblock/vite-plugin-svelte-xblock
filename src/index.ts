import fs from "fs/promises";
import path from "path";
import type { Plugin, TransformResult } from "vite";

interface ScriptOrStyle {
    attrs: string;
    content: string;
}

interface ParsedXBlockContent {
    scripts: ScriptOrStyle[];
    template: string;
    styles: ScriptOrStyle[];
}

interface XBlockUsage {
    usedBy: string;
    importName: string;
}

export default function svelteXBlockPlugin(): Plugin {
    const xblockCache = new Map<string, string>();
    const xblockUsage = new Map<string, XBlockUsage>();

    return {
        name: "svelte-xblock",
        enforce: "pre", // Run before other plugins

        async transform(code: string, id: string): Promise<TransformResult | null> {
            if (!id.endsWith(".svelte")) return null;

            const xblockRegex = /import\s+(\w+)\s+from\s+["'](.+?)\.svelte\.xblock["'];/g;
            const xblockMatches = [...code.matchAll(xblockRegex)];

            if (xblockMatches.length === 0) return null;

            let modifiedCode = code;

            for (const [fullMatch, importName, xblockPath] of xblockMatches) {
                const fullXblockPath = path.resolve(path.dirname(id), `${xblockPath}.svelte.xblock`);

                // Check if the XBlock has already been used
                if (xblockUsage.has(fullXblockPath)) {
                    const usage = xblockUsage.get(fullXblockPath)!;
                    const allUsages = Array.from(xblockUsage.entries())
                        .map(([path, usage]) => `  - ${path} (imported as "${usage.importName}" in ${usage.usedBy})`)
                        .join("\n");

                    throw new Error(`
XBlock file "${xblockPath}.svelte.xblock" is already used.
Current file: ${id} (trying to import as "${importName}")
Previous usage: ${usage.usedBy} (imported as "${usage.importName}")

All XBlock usages:
${allUsages}

XBlocks can only be used once. Please ensure you're not accidentally importing the same XBlock multiple times.
          `);
                }

                // Record the usage of this XBlock
                xblockUsage.set(fullXblockPath, { usedBy: id, importName });

                let xblockContent: string;
                if (xblockCache.has(fullXblockPath)) {
                    xblockContent = xblockCache.get(fullXblockPath)!;
                } else {
                    try {
                        xblockContent = await fs.readFile(fullXblockPath, "utf-8");
                        xblockCache.set(fullXblockPath, xblockContent);
                    } catch (error) {
                        console.error(`Error reading XBlock file: ${fullXblockPath}`);
                        console.error(error);
                        throw new Error(`
Failed to read XBlock file: ${xblockPath}.svelte.xblock. 
Please ensure the file exists and is accessible.
            `);
                    }
                }

                const { scripts, template, styles } = parseXBlockContent(xblockContent);

                // Check for variable name conflicts
                const mainFileVariables = extractVariables(modifiedCode);
                const xblockVariables = extractVariablesFromScripts(scripts);
                const conflictingVariables = findConflictingVariables(mainFileVariables, xblockVariables);

                if (conflictingVariables.length > 0) {
                    throw new Error(`
Variable name conflict detected in "${id}" when importing "${xblockPath}.svelte.xblock". 
Conflicting variables: ${conflictingVariables.join(", ")}
          `);
                }

                // Remove the original import statement
                modifiedCode = modifiedCode.replace(fullMatch, "");

                // Merge scripts
                modifiedCode = mergeScripts(modifiedCode, scripts);

                // Replace xblock usage in the template
                modifiedCode = replaceXBlockInTemplate(modifiedCode, importName, template);

                // Merge styles
                modifiedCode = mergeStyles(modifiedCode, styles);
            }

            return {
                code: modifiedCode,
                map: null // Source map generation could be added here if needed
            };
        }
    };
}

function parseXBlockContent(content: string): ParsedXBlockContent {
    const scriptRegex = /<script([^>]*)>([\s\S]*?)<\/script>/g;
    const styleRegex = /<style([^>]*)>([\s\S]*?)<\/style>/g;

    const scripts: ScriptOrStyle[] = [...content.matchAll(scriptRegex)].map(match => ({
        attrs: match[1].trim(),
        content: match[2].trim()
    }));

    const styles: ScriptOrStyle[] = [...content.matchAll(styleRegex)].map(match => ({
        attrs: match[1].trim(),
        content: match[2].trim()
    }));

    // Remove all script and style tags to isolate the template
    let template = content.replace(scriptRegex, "").replace(styleRegex, "").trim();

    // If the remaining content is wrapped in a <template> tag, extract its contents
    const templateMatch = template.match(/^<template>([\s\S]*)<\/template>$/);
    if (templateMatch) {
        template = templateMatch[1].trim();
    }

    return { scripts, template, styles };
}

function extractVariablesFromScripts(scripts: ScriptOrStyle[]): Set<string> {
    const allVariables = new Set<string>();
    for (const script of scripts) {
        const scriptVariables = extractVariables(script.content);
        for (const variable of scriptVariables) {
            allVariables.add(variable);
        }
    }
    return allVariables;
}

function extractVariables(code: string): Set<string> {
    // Remove comments
    code = code.replace(/\/\*[\s\S]*?\*\/|([^:\\]|^)\/\/.*$/gm, "$1");

    const variableDeclarations = [
        // Regular variable declarations
        ...code.matchAll(/\b(?:let|const|var)\s+(\w+)(?:\s*=|\s*;|\s*$)/g),
        // Destructuring assignments
        ...code.matchAll(/\b(?:let|const|var)\s+\{([^}]+)\}/g),
        ...code.matchAll(/\b(?:let|const|var)\s+\[([^\]]+)\]/g)
    ];

    const variables = new Set<string>();

    for (const match of variableDeclarations) {
        if (match[1]) {
            match[1].split(",").forEach(v => {
                const trimmed = v.trim().split(":")[0].split("=")[0].trim();
                if (trimmed) variables.add(trimmed);
            });
        }
    }

    return variables;
}

function findConflictingVariables(set1: Set<string>, set2: Set<string>): string[] {
    return [...set1].filter(variable => set2.has(variable));
}

function mergeScripts(mainCode: string, xblockScripts: ScriptOrStyle[]): string {
    const scriptRegex = /<script([^>]*)>([\s\S]*?)<\/script>/g;
    let modifiedCode = mainCode;

    xblockScripts.forEach(xblockScript => {
        const mainScriptMatch = [...modifiedCode.matchAll(scriptRegex)].find(match =>
            match[1].trim() === xblockScript.attrs
        );

        if (mainScriptMatch) {
            // If a matching script tag is found, merge the content
            const mergedContent = `${mainScriptMatch[2]}\n${xblockScript.content}`;
            modifiedCode = modifiedCode.replace(mainScriptMatch[0], `<script${xblockScript.attrs}>${mergedContent}</script>`);
        } else {
            // If no matching script tag is found, append a new one
            modifiedCode += `\n<script${xblockScript.attrs}>${xblockScript.content}</script>`;
        }
    });

    return modifiedCode;
}

function replaceXBlockInTemplate(mainCode: string, importName: string, xblockTemplate: string): string {
    const xblockUsageRegex = new RegExp(`<${importName}\\s*\\/?>`, "g");
    return mainCode.replace(xblockUsageRegex, xblockTemplate);
}

function mergeStyles(mainCode: string, xblockStyles: ScriptOrStyle[]): string {
    const styleRegex = /<style([^>]*)>([\s\S]*?)<\/style>/g;
    let modifiedCode = mainCode;

    xblockStyles.forEach(xblockStyle => {
        const mainStyleMatch = [...modifiedCode.matchAll(styleRegex)].find(match =>
            match[1].trim() === xblockStyle.attrs
        );

        if (mainStyleMatch) {
            // If a matching style tag is found, merge the content
            const mergedContent = `${mainStyleMatch[2]}\n${xblockStyle.content}`;
            modifiedCode = modifiedCode.replace(mainStyleMatch[0], `<style${xblockStyle.attrs}>${mergedContent}</style>`);
        } else {
            // If no matching style tag is found, append a new one
            modifiedCode += `\n<style${xblockStyle.attrs}>${xblockStyle.content}</style>`;
        }
    });

    return modifiedCode;
}