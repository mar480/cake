import { TreeNode, getTreeNodeVisualSpec } from "./tree_utils";

export interface TreeSnapshotNode {
  key: string;
  parentKey: string | null;
  label: string;
  qname: string | null;
  depth: number;
  path: string;
  isMatch: boolean;
  isExpanded: boolean;
  nodeType: string;
  fullType: string | null;
  xbrlType: string | null;
  substitutionGroup: string | null;
  iconGlyph: string;
  iconColor: string;
  secondaryGlyph?: string;
  secondaryColor?: string;
  tertiaryGlyph?: string;
  tertiaryColor?: string;
}

export interface TreeExportSnapshot {
  generatedAt: string;
  year: string | null;
  entrypoint: string | null;
  network: string;
  networkLabel: string;
  language: "en" | "cy";
  treeFilter: string;
  expandedKeys: string[];
  visibleNodeCount: number;
  visibleNodes: TreeSnapshotNode[];
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function matchesSearch(node: TreeNode, treeFilter: string, language: "en" | "cy"): boolean {
  const normalizedFilter = normalizeSearchValue(treeFilter);
  if (!normalizedFilter) {
    return false;
  }

  const haystack = normalizeSearchValue(
    [
      language === "cy" && node.data?.label_cy ? node.data.label_cy : node.label,
      node.data?.qname ?? "",
      node.data?.definition ?? "",
      node.data?.elr ?? "",
    ].join(" ")
  );

  return normalizedFilter
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeCsvCell(value: unknown): string {
  const stringValue =
    value === null || value === undefined ? "" : typeof value === "string" ? value : String(value);
  return `"${stringValue.replace(/"/g, "\"\"")}"`;
}

function mapNodeToSnapshotNode({
  node,
  depth,
  parentKey,
  path,
  isMatch,
  isExpanded,
  language,
}: {
  node: TreeNode;
  depth: number;
  parentKey: string | null;
  path: string;
  isMatch: boolean;
  isExpanded: boolean;
  language: "en" | "cy";
}): TreeSnapshotNode {
  const label = language === "cy" && node.data?.label_cy ? node.data.label_cy : node.label;
  const visual = getTreeNodeVisualSpec(node.data);

  return {
    key: node.key,
    parentKey,
    label,
    qname: node.data?.qname ?? null,
    depth,
    path,
    isMatch,
    isExpanded,
    nodeType: visual.nodeTypeLabel,
    fullType: node.data?.full_type ?? null,
    xbrlType: node.data?.xbrl_type ?? null,
    substitutionGroup: node.data?.substitution_group ?? null,
    iconGlyph: visual.iconGlyph,
    iconColor: visual.iconColor,
    secondaryGlyph: visual.secondaryGlyph,
    secondaryColor: visual.secondaryColor,
    tertiaryGlyph: visual.tertiaryGlyph,
    tertiaryColor: visual.tertiaryColor,
  };
}

export function buildTreeExportSnapshot({
  treeNodes,
  expandedKeys,
  treeFilter,
  language,
  network,
  networkLabel,
  year,
  entrypoint,
}: {
  treeNodes: TreeNode[];
  expandedKeys: Record<string, boolean>;
  treeFilter: string;
  language: "en" | "cy";
  network: string;
  networkLabel: string;
  year: string | null;
  entrypoint: string | null;
}): TreeExportSnapshot {
  const visibleNodes: TreeSnapshotNode[] = [];
  const hasActiveFilter = normalizeSearchValue(treeFilter).length > 0;

  const visitFiltered = (
    node: TreeNode,
    depth: number,
    parentKey: string | null,
    ancestorLabels: string[]
  ): TreeSnapshotNode[] => {
    const label = language === "cy" && node.data?.label_cy ? node.data.label_cy : node.label;
    const isMatch = matchesSearch(node, treeFilter, language);
    const nextAncestors = [...ancestorLabels, label];
    const childSnapshots = (node.children ?? []).flatMap((child) =>
      visitFiltered(child, depth + 1, node.key, nextAncestors)
    );

    if (!isMatch && childSnapshots.length === 0) {
      return [];
    }

    return [
      mapNodeToSnapshotNode({
        node,
        depth,
        parentKey,
        path: nextAncestors.join(" / "),
        isMatch,
        isExpanded: true,
        language,
      }),
      ...childSnapshots,
    ];
  };

  const walkWithoutFilter = (
    node: TreeNode,
    depth: number,
    parentKey: string | null,
    ancestorLabels: string[]
  ) => {
    const label = language === "cy" && node.data?.label_cy ? node.data.label_cy : node.label;
    const nextAncestors = [...ancestorLabels, label];
    visibleNodes.push(
      mapNodeToSnapshotNode({
        node,
        depth,
        parentKey,
        path: nextAncestors.join(" / "),
        isMatch: false,
        isExpanded: Boolean(expandedKeys[node.key]),
        language,
      })
    );

    if (!expandedKeys[node.key]) {
      return;
    }

    (node.children ?? []).forEach((child) => {
      walkWithoutFilter(child, depth + 1, node.key, nextAncestors);
    });
  };

  if (hasActiveFilter) {
    treeNodes.forEach((node) => {
      visibleNodes.push(...visitFiltered(node, 0, null, []));
    });
  } else {
    treeNodes.forEach((node) => {
      walkWithoutFilter(node, 0, null, []);
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    year,
    entrypoint,
    network,
    networkLabel,
    language,
    treeFilter,
    expandedKeys: Object.keys(expandedKeys).filter((key) => expandedKeys[key]),
    visibleNodeCount: visibleNodes.length,
    visibleNodes,
  };
}

export function buildTreeSnapshotCsv(snapshot: TreeExportSnapshot): string {
  const header = [
    "label",
    "qname",
    "path",
    "depth",
    "node_type",
    "is_match",
    "is_expanded",
    "full_type",
    "xbrl_type",
    "substitution_group",
  ];

  const rows = snapshot.visibleNodes.map((node) =>
    [
      node.label,
      node.qname ?? "",
      node.path,
      node.depth,
      node.nodeType,
      node.isMatch,
      node.isExpanded,
      node.fullType ?? "",
      node.xbrlType ?? "",
      node.substitutionGroup ?? "",
    ]
      .map(escapeCsvCell)
      .join(",")
  );

  return [header.join(","), ...rows].join("\r\n");
}

function buildTreeSnapshotHtmlBody(snapshot: TreeExportSnapshot): string {
  const rows = snapshot.visibleNodes
    .map((node) => {
      const marginLeft = `${node.depth * 24}px`;
      const qnameMarkup = node.qname
        ? `<div class="tree-export-qname">${escapeHtml(node.qname)}</div>`
        : "";
      const badges = [
        `<span class="tree-export-badge">${escapeHtml(node.nodeType)}</span>`,
        node.isMatch ? `<span class="tree-export-badge tree-export-match">Match</span>` : "",
        node.xbrlType ? `<span class="tree-export-badge">${escapeHtml(node.xbrlType)}</span>` : "",
      ]
        .filter(Boolean)
        .join("");

      const secondaryGlyph = node.secondaryGlyph
        ? `<span class="tree-export-secondary" style="color:${node.secondaryColor ?? "#64748b"}">${escapeHtml(node.secondaryGlyph)}</span>`
        : "";
      const tertiaryGlyph = node.tertiaryGlyph
        ? `<span class="tree-export-secondary" style="color:${node.tertiaryColor ?? "#64748b"}">${escapeHtml(node.tertiaryGlyph)}</span>`
        : "";

      return `
        <div class="tree-export-row${node.isMatch ? " is-match" : ""}" style="margin-left:${marginLeft}">
          <div class="tree-export-title-row">
            <span class="tree-export-glyph" style="color:${node.iconColor}">${escapeHtml(node.iconGlyph)}</span>
            ${secondaryGlyph}
            ${tertiaryGlyph}
            <span class="tree-export-label">${escapeHtml(node.label)}</span>
          </div>
          ${qnameMarkup}
          <div class="tree-export-badges">${badges}</div>
        </div>
      `;
    })
    .join("");

  const metaParts = [
    snapshot.year ? escapeHtml(snapshot.year) : "",
    snapshot.entrypoint ? escapeHtml(snapshot.entrypoint) : "",
    snapshot.treeFilter ? `filter: ${escapeHtml(snapshot.treeFilter)}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  return `
    <div class="tree-export-wrap">
      <header class="tree-export-header">
        <div>
          <div class="tree-export-title">${escapeHtml(snapshot.networkLabel)} tree export</div>
          <div class="tree-export-meta">${metaParts}</div>
        </div>
        <div class="tree-export-count">${snapshot.visibleNodeCount} visible nodes</div>
      </header>
      <main class="tree-export-list">
        ${rows}
      </main>
    </div>
  `;
}

function buildTreeSnapshotStyles(): string {
  return `
      body {
        margin: 0;
        padding: 14px;
        background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%);
        font-family: "Segoe UI", Arial, sans-serif;
        color: #0f172a;
      }
      .tree-export-wrap {
        max-width: 1200px;
        margin: 0 auto;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 18px;
        box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
        overflow: hidden;
      }
      .tree-export-header {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding: 12px 16px;
        background: linear-gradient(135deg, #dbeafe 0%, #f8fafc 100%);
        border-bottom: 1px solid #cbd5e1;
      }
      .tree-export-title {
        font-size: 17px;
        font-weight: 700;
      }
      .tree-export-meta,
      .tree-export-count,
      .tree-export-qname {
        font-size: 11px;
        color: #475569;
      }
      .tree-export-list {
        padding: 8px 12px 12px;
      }
      .tree-export-row {
        position: relative;
        padding: 6px 8px;
        border-radius: 10px;
        border: 1px solid transparent;
      }
      .tree-export-row.is-match {
        background: #fef9c3;
        border-color: #facc15;
      }
      .tree-export-title-row {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
      }
      .tree-export-glyph,
      .tree-export-secondary {
        display: inline-block;
        width: 14px;
        text-align: center;
        font-weight: 700;
      }
      .tree-export-label {
        font-weight: 600;
      }
      .tree-export-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 4px;
      }
      .tree-export-badge {
        display: inline-flex;
        align-items: center;
        padding: 1px 7px;
        border-radius: 999px;
        background: #e2e8f0;
        color: #334155;
        font-size: 10px;
      }
      .tree-export-badge.tree-export-match {
        background: #bfdbfe;
        color: #1d4ed8;
      }
    `;
}

export function buildTreeSnapshotHtmlDocument(snapshot: TreeExportSnapshot): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(snapshot.networkLabel)} tree export</title>
    <style>${buildTreeSnapshotStyles()}</style>
  </head>
  <body>
    ${buildTreeSnapshotHtmlBody(snapshot)}
  </body>
</html>`;
}

export function buildTreeSnapshotJson(snapshot: TreeExportSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}

export async function buildTreeSnapshotPngBlob(snapshot: TreeExportSnapshot): Promise<Blob> {
  const maxDepth = snapshot.visibleNodes.reduce((largest, node) => Math.max(largest, node.depth), 0);
  const width = Math.min(1800, Math.max(980, 700 + maxDepth * 44));
  const headerHeight = 72;

  const measureCanvas = document.createElement("canvas");
  const measureContext = measureCanvas.getContext("2d");
  if (!measureContext) {
    throw new Error("Canvas context unavailable for PNG export.");
  }

  const wrapText = (
    context: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
  ): string[] => {
    if (!text) return [];
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const nextLine = currentLine ? `${currentLine} ${word}` : word;
      if (context.measureText(nextLine).width <= maxWidth || !currentLine) {
        currentLine = nextLine;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  };

  const layoutRows = snapshot.visibleNodes.map((node) => {
    const cardX = 24 + node.depth * 20;
    const cardWidth = Math.max(280, width - cardX - 28);
    const textX = cardX + 28;
    const textWidth = cardWidth - 42;
    const badges = [node.nodeType, node.isMatch ? "Match" : "", node.xbrlType ?? ""].filter(Boolean);

    measureContext.font = '600 13px "Segoe UI", Arial, sans-serif';
    const labelLines = wrapText(measureContext, node.label, textWidth);

    measureContext.font = '12px "Segoe UI", Arial, sans-serif';
    const qnameLines = node.qname ? wrapText(measureContext, node.qname, textWidth) : [];

    measureContext.font = '11px "Segoe UI", Arial, sans-serif';
    let badgeRows = 1;
    let badgeRowWidth = 0;
    for (const badge of badges) {
      const badgeWidth = measureContext.measureText(badge).width + 16;
      if (badgeRowWidth > 0 && badgeRowWidth + badgeWidth + 6 > textWidth) {
        badgeRows += 1;
        badgeRowWidth = badgeWidth;
      } else {
        badgeRowWidth += badgeRowWidth > 0 ? badgeWidth + 6 : badgeWidth;
      }
    }

    const topPadding = 8;
    const titleHeight = labelLines.length * 16;
    const qnameHeight = qnameLines.length > 0 ? qnameLines.length * 14 + 2 : 0;
    const badgesHeight = badges.length > 0 ? badgeRows * 22 : 0;
    const bottomPadding = 8;
    const cardHeight = topPadding + titleHeight + qnameHeight + badgesHeight + bottomPadding;

    return {
      node,
      cardX,
      cardWidth,
      textX,
      textWidth,
      labelLines,
      qnameLines,
      badges,
      badgeRows,
      cardHeight,
    };
  });

  const contentHeight = layoutRows.reduce((sum, row) => sum + row.cardHeight + 8, 0);
  const height = Math.min(12000, Math.max(220, headerHeight + contentHeight + 28));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context unavailable for PNG export.");
  }

  const drawRoundedRect = (
    x: number,
    y: number,
    rectWidth: number,
    rectHeight: number,
    radius: number,
    fillStyle: string,
    strokeStyle?: string
  ) => {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.lineTo(x + rectWidth - radius, y);
    context.quadraticCurveTo(x + rectWidth, y, x + rectWidth, y + radius);
    context.lineTo(x + rectWidth, y + rectHeight - radius);
    context.quadraticCurveTo(x + rectWidth, y + rectHeight, x + rectWidth - radius, y + rectHeight);
    context.lineTo(x + radius, y + rectHeight);
    context.quadraticCurveTo(x, y + rectHeight, x, y + rectHeight - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
    context.fillStyle = fillStyle;
    context.fill();
    if (strokeStyle) {
      context.strokeStyle = strokeStyle;
      context.lineWidth = 1;
      context.stroke();
    }
  };

  const fillVerticalGradient = () => {
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#eff6ff");
    gradient.addColorStop(1, "#ffffff");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  };

  const metaParts = [
    snapshot.year ?? "",
    snapshot.entrypoint ?? "",
    snapshot.treeFilter ? `filter: ${snapshot.treeFilter}` : "",
  ].filter(Boolean);

  fillVerticalGradient();
  drawRoundedRect(14, 14, width - 28, height - 28, 18, "#ffffff", "#cbd5e1");
  drawRoundedRect(14, 14, width - 28, 74, 18, "#dbeafe");
  context.fillStyle = "#0f172a";
  context.font = '700 22px "Segoe UI", Arial, sans-serif';
  context.fillText(`${snapshot.networkLabel} tree export`, 30, 44);
  context.fillStyle = "#475569";
  context.font = '12px "Segoe UI", Arial, sans-serif';
  context.fillText(metaParts.join(" | "), 30, 64);
  context.textAlign = "right";
  context.fillText(`${snapshot.visibleNodeCount} visible nodes`, width - 34, 54);
  context.textAlign = "left";

  let currentY = 102;
  for (const row of layoutRows) {
    const { node, cardX, cardWidth, textX, textWidth, labelLines, qnameLines, badges, cardHeight } = row;
    const isMatch = node.isMatch;

    drawRoundedRect(
      cardX,
      currentY,
      cardWidth,
      cardHeight,
      10,
      isMatch ? "#fef3c7" : "#ffffff",
      isMatch ? "#facc15" : undefined
    );

    context.fillStyle = node.iconColor;
    context.font = '700 16px "Segoe UI Symbol", "Segoe UI Emoji", "Segoe UI", Arial, sans-serif';
    context.fillText(node.iconGlyph, cardX + 10, currentY + 18);

    let glyphOffsetX = cardX + 28;
    if (node.tertiaryGlyph) {
      context.fillStyle = node.tertiaryColor ?? "#64748b";
      context.fillText(node.tertiaryGlyph, glyphOffsetX, currentY + 18);
      glyphOffsetX += 14;
    }

    context.fillStyle = "#0f172a";
    context.font = '600 13px "Segoe UI", Arial, sans-serif';
    let textY = currentY + 18;
    for (const line of labelLines) {
      context.fillText(line, glyphOffsetX, textY, textWidth);
      textY += 16;
    }

    if (qnameLines.length > 0) {
      context.fillStyle = "#475569";
      context.font = '12px "Segoe UI", Arial, sans-serif';
      for (const line of qnameLines) {
        context.fillText(line, glyphOffsetX, textY, textWidth);
        textY += 14;
      }
    }

    let badgeX = textX;
    let badgeY = textY + 2;
    for (const badge of badges) {
      context.font = '11px "Segoe UI", Arial, sans-serif';
      const badgeWidth = context.measureText(badge).width + 16;
      if (badgeX > textX && badgeX + badgeWidth > cardX + cardWidth - 10) {
        badgeX = textX;
        badgeY += 22;
      }
      drawRoundedRect(
        badgeX,
        badgeY,
        badgeWidth,
        18,
        9,
        badge === "Match" ? "#bfdbfe" : "#e2e8f0"
      );
      context.fillStyle = badge === "Match" ? "#1d4ed8" : "#334155";
      context.fillText(badge, badgeX + 8, badgeY + 13);
      badgeX += badgeWidth + 6;
    }

    currentY += cardHeight + 8;
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Failed to create PNG export."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

export function downloadTextFile(contents: string, filename: string, mimeType: string): void {
  const blob = new Blob([contents], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}
