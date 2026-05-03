import type {
  VendorSearchResult,
  VendorProfile,
  StackRecommendation,
  DecisionMatrixRow,
  VendorCostEstimate,
  UnknownCorpusResult,
  EvidenceRow,
  StackProfile,
} from "./types.js";
import { buildVendorClaims } from "./decision.js";

export function formatSearchResults(results: VendorSearchResult[]): string {
  if (results.length === 0) {
    return "No vendors found matching your query. Try a different category or broader search terms.";
  }

  return results
    .map(
      (v) =>
        `**${v.name}** (${v.id})\n${v.description}\nPricing: ${v.pricingModel} | Best for: ${v.bestFor}\nLast updated: ${v.lastUpdated}`
    )
    .join("\n\n---\n\n");
}

export function formatUnknown(unknown: UnknownCorpusResult): string {
  return `${unknown.message}\n\nAvailable categories: ${unknown.availableCategories.join(", ")}`;
}

export function formatVendorProfile(vendor: VendorProfile): string {
  const sections: string[] = [];

  sections.push(`# ${vendor.name}\n${vendor.description}\n${vendor.positioning}`);

  // Pricing
  const pricingLines = [`**Pricing model:** ${vendor.pricing.model}`];
  if (vendor.pricing.freeTier?.exists) {
    pricingLines.push(
      `**Free tier:** ${vendor.pricing.freeTier.generous ? "Generous" : "Limited"} - ${vendor.pricing.freeTier.keyLimits.join(", ")}`
    );
    pricingLines.push(
      `**Credit card required:** ${vendor.pricing.freeTier.creditCardRequired ? "Yes" : "No"}`
    );
  }
  for (const tier of vendor.pricing.tiers) {
    pricingLines.push(`**${tier.name}:** ${tier.price} - ${tier.keyInclusions.join(", ")}`);
  }
  sections.push(`## Pricing\n${pricingLines.join("\n")}`);

  // Cost estimates
  const cost = vendor.pricing.estimatedMonthlyCost;
  sections.push(
    `## Estimated Monthly Cost\n- 100 users: ${cost.at100Users}\n- 1K users: ${cost.at1kUsers}\n- 10K users: ${cost.at10kUsers}\n- First paid trigger: ${cost.firstPaidTrigger}`
  );

  // Limits
  if (vendor.limits.length > 0) {
    const limitLines = vendor.limits.map(
      (l) => `- **${l.dimension}:** Free: ${l.free} | Paid: ${l.paid}${l.notes ? ` (${l.notes})` : ""}`
    );
    sections.push(`## Limits\n${limitLines.join("\n")}`);
  }

  // Key features
  if (vendor.features.length > 0) {
    const featureLines = vendor.features.map(
      (f) => `- ${f.included ? "yes" : "no"} ${f.key} (${f.tier})${f.notes ? ` - ${f.notes}` : ""}`
    );
    sections.push(`## Key Features\n${featureLines.join("\n")}`);
  }

  // Known issues
  if (vendor.signals.knownIssues.length > 0) {
    sections.push(
      `## Known Issues & Gotchas\n${vendor.signals.knownIssues.map((i) => `- ${i}`).join("\n")}`
    );
  }

  // Comparisons
  if (vendor.comparisons.length > 0) {
    const compLines = vendor.comparisons.map(
      (c) =>
        `**vs ${c.vsVendor}:** Choose ${vendor.name} if ${c.advantage}. Choose ${c.vsVendor} if ${c.disadvantage}.`
    );
    sections.push(`## Comparisons\n${compLines.join("\n\n")}`);
  }

  // Company
  sections.push(
    `## Company\nFounded: ${vendor.company.founded} | Team: ${vendor.company.teamSize} | Funding: ${vendor.company.funding}\nOpen source: ${vendor.company.openSource ? "Yes" : "No"}${vendor.company.githubStars ? ` (${vendor.company.githubStars.toLocaleString()} stars)` : ""}`
  );

  sections.push(
    `## Sources\n${buildVendorClaims(vendor)
      .map(
        (claim) =>
          `- ${claim.path}: ${claim.sourceUrl} (observed ${claim.observedAt}, confidence ${claim.confidence})`
      )
      .join("\n")}`
  );

  return sections.join("\n\n");
}

export function formatStackRecommendation(rec: StackRecommendation): string {
  if (rec.decisionRecord) {
    return formatStackDecisionRecord(rec);
  }

  const lines: string[] = ["# Recommended Stack\n"];

  for (const [layer, choice] of Object.entries(rec.stack)) {
    lines.push(`**${layer}:** ${choice.vendor}\n${choice.reason}\n`);
  }

  const cost = rec.costEstimate;
  lines.push(
    `## Cost Estimate\n- 100 users: ${cost.at100Users}\n- 1K users: ${cost.at1kUsers}\n- 10K users: ${cost.at10kUsers}\n- First paid trigger: ${cost.firstPaidTrigger}`
  );

  if (rec.alternativeStack) {
    lines.push(`\n## Alternative\nIf: ${rec.alternativeStack.if}`);
    for (const [layer, swap] of Object.entries(rec.alternativeStack.swap)) {
      lines.push(`Swap ${layer} -> ${swap.vendor}: ${swap.reason}`);
    }
  }

  if (rec.decisionMatrix?.length) {
    lines.push("\n## Decision Matrix");
    for (const row of rec.decisionMatrix) {
      lines.push(
        `- ${row.layer}: ${row.vendorName} (${row.fit}) - ${row.why} Cost: ${row.estimatedMonthlyCost}`
      );
    }
  }

  if (rec.assumptions?.length) {
    lines.push("\n## Assumptions");
    lines.push(...rec.assumptions.map((assumption) => `- ${assumption}`));
  }

  if (rec.unknowns?.length) {
    lines.push("\n## Unknowns");
    lines.push(...rec.unknowns.map((unknown) => `- ${unknown}`));
  }

  return lines.join("\n");
}

function formatStackDecisionRecord(rec: StackRecommendation): string {
  const record = rec.decisionRecord!;
  const lines = ["# Stack Decision Record", "", record.recommendation.summary, ""];

  lines.push("## Recommendation");
  for (const choice of record.recommendation.choices) {
    lines.push(
      `- ${choice.layer}: ${choice.vendorName} (${choice.fit}, ${choice.confidence} confidence) - ${choice.reason} Cost: ${choice.estimatedMonthlyCost}`
    );
  }

  const cost = rec.costEstimate;
  lines.push("");
  lines.push("## Cost");
  lines.push(`- 100 users: ${cost.at100Users}`);
  lines.push(`- 1K users: ${cost.at1kUsers}`);
  lines.push(`- 10K users: ${cost.at10kUsers}`);
  if (cost.monthlyUsd !== undefined && cost.monthlyUsd !== null) {
    lines.push(`- Workload estimate: $${cost.monthlyUsd}/month`);
  }
  lines.push(`- First paid trigger: ${cost.firstPaidTrigger}`);

  if (record.alternativesConsidered.length > 0) {
    lines.push("");
    lines.push("## Alternatives Considered");
    lines.push(
      ...record.alternativesConsidered
        .slice(0, 8)
        .map(
          (alternative) =>
            `- ${alternative.layer}: ${alternative.vendorName} if ${alternative.condition.toLowerCase()}`
        )
    );
  }

  if (record.switchingCosts.length > 0) {
    lines.push("");
    lines.push("## Switching Costs");
    lines.push(
      ...record.switchingCosts.map((costItem) => `- ${costItem.layer}: ${costItem.note}`)
    );
  }

  if (record.assumptions.length > 0) {
    lines.push("");
    lines.push("## Assumptions");
    lines.push(...record.assumptions.map((assumption) => `- ${assumption}`));
  }

  if (record.unknowns.length > 0) {
    lines.push("");
    lines.push("## Unknowns");
    lines.push(...record.unknowns.map((unknown) => `- ${unknown}`));
  }

  if (record.evidence.length > 0) {
    lines.push("");
    lines.push("## Evidence");
    lines.push(
      ...record.evidence
        .slice(0, 10)
        .map(
          (source) =>
            `- ${source.summary} (${source.confidence}, observed ${source.observedAt}): ${source.sourceUrl}`
        )
    );
  }

  return lines.join("\n");
}

export function formatDecisionMatrix(rows: DecisionMatrixRow[]): string {
  if (rows.length === 0) return "No vendors found in the BuyAPI corpus.";
  return rows
    .map((row) => {
      const lines = [
        `**${row.vendorName}** (${row.fit})`,
        row.why,
        `Cost: ${row.estimatedMonthlyCost}`,
        `Confidence: ${row.confidence}`,
      ];
      if (row.capabilities.length) {
        lines.push(
          "Capabilities:",
          ...row.capabilities.map(
            (capability) =>
              `- ${capability.capability}: ${capability.support} (${capability.evidence})`
          )
        );
      }
      if (row.tradeoffs.length) {
        lines.push(`Tradeoffs: ${row.tradeoffs.join("; ")}`);
      }
      return lines.join("\n");
    })
    .join("\n\n---\n\n");
}

export function formatCostEstimates(estimates: VendorCostEstimate[]): string {
  if (estimates.length === 0) return "No cost estimates available.";
  return estimates
    .map((estimate) => {
      const lines = [
        `**${estimate.vendorName}** (${estimate.vendorId})`,
        `Cost: ${estimate.display}`,
        `Basis: ${estimate.basis}`,
        `Confidence: ${estimate.confidence}`,
      ];
      if (estimate.assumptions.length) {
        lines.push(`Assumptions: ${estimate.assumptions.join("; ")}`);
      }
      if (estimate.unknowns.length) {
        lines.push(`Unknowns: ${estimate.unknowns.join("; ")}`);
      }
      return lines.join("\n");
    })
    .join("\n\n---\n\n");
}

export function formatEvidenceRows(rows: EvidenceRow[]): string {
  if (rows.length === 0) {
    return "No reviewed evidence rows are attached yet.";
  }

  return rows
    .map((row) => {
      const lines = [
        `**${row.sourceType.replaceAll("-", " ")}** · ${row.stance} · ${row.confidence}`,
        row.summary,
        `Source: ${row.sourceTitle} (${row.sourceUrl})`,
        `Observed: ${row.observedAt}${row.authorName ? ` · Author: ${row.authorName}` : ""}`,
      ];
      if (row.appliesTo.length) {
        lines.push(`Applies to: ${row.appliesTo.join(", ")}`);
      }
      return lines.join("\n");
    })
    .join("\n\n---\n\n");
}

export function formatStackRows(rows: StackProfile[]): string {
  if (rows.length === 0) {
    return "No reviewed or curated public stack profiles found yet. Treat this as sparse BuyAPI coverage, not evidence that no similar builders use this tool.";
  }

  return rows
    .map((row) => {
      const tools = row.tools
        .map(
          (tool) =>
            `- ${tool.vendorSlug}: ${tool.role} (${tool.confidence} confidence)`
        )
        .join("\n");
      const context = formatStackContext(row.context);
      return `**${row.projectName}** · ${row.ownerName} · ${row.stage}\n${row.summary}\nAudience: ${row.audience.join(", ")}${context ? `\nContext: ${context}` : ""}\n${tools}`;
    })
    .join("\n\n---\n\n");
}

function formatStackContext(context: StackProfile["context"]) {
  if (!context) return "";
  return [
    ...context.languages,
    ...context.frameworks,
    ...context.runtimes,
    ...context.packageManagers,
    ...context.testing,
    ...context.devWorkflow,
  ].join(", ");
}
