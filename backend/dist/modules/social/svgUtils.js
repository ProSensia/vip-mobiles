"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeXml = escapeXml;
exports.wrapText = wrapText;
function escapeXml(input) {
    return input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}
/** Greedy word-wrap for SVG <text>/<tspan> lines (no native text flow in SVG). */
function wrapText(text, maxCharsPerLine, maxLines) {
    const words = text.trim().split(/\s+/);
    const lines = [];
    let current = "";
    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length > maxCharsPerLine && current) {
            lines.push(current);
            current = word;
        }
        else {
            current = candidate;
        }
        if (lines.length === maxLines)
            break;
    }
    if (current && lines.length < maxLines)
        lines.push(current);
    if (lines.length === maxLines) {
        const last = lines[maxLines - 1];
        if (last.length > maxCharsPerLine - 1) {
            lines[maxLines - 1] = `${last.slice(0, maxCharsPerLine - 1).trimEnd()}…`;
        }
    }
    return lines;
}
