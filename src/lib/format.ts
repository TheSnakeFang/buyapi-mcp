import type {
  VendorSearchResult,
  VendorProfile,
  StackRecommendation,
} from "./types.js";

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

export function formatVendorProfile(vendor: VendorProfile): string {
  const sections: string[] = [];

  sections.push(`# ${vendor.name}\n${vendor.description}\n${vendor.positioning}`);

  // Pricing
  const pricingLines = [`**Pricing model:** ${vendor.pricing.model}`];
  if (vendor.pricing.freeTier?.exists) {
    pricingLines.push(
      `**Free tier:** ${vendor.pricing.freeTier.generous ? "Generous" : "Limited"} — ${vendor.pricing.freeTier.keyLimits.join(", ")}`
    );
    pricingLines.push(
      `**Credit card required:** ${vendor.pricing.freeTier.creditCardRequired ? "Yes" : "No"}`
    );
  }
  for (const tier of vendor.pricing.tiers) {
    pricingLines.push(`**${tier.name}:** ${tier.price} — ${tier.keyInclusions.join(", ")}`);
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
      (f) => `- ${f.included ? "✓" : "✗"} ${f.key} (${f.tier})${f.notes ? ` — ${f.notes}` : ""}`
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

  return sections.join("\n\n");
}

export function formatStackRecommendation(rec: StackRecommendation): string {
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
      lines.push(`Swap ${layer} → ${swap.vendor}: ${swap.reason}`);
    }
  }

  return lines.join("\n");
}
