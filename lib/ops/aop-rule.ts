export type AopReason = "no115b" | "hybridDrg";

export function getAopEligibility(input: { aop115b: boolean; hybridDrg: boolean }): {
  allowed: boolean;
  reasons: AopReason[];
} {
  const reasons: AopReason[] = [];
  if (!input.aop115b) reasons.push("no115b");
  if (input.hybridDrg) reasons.push("hybridDrg");
  return { allowed: reasons.length === 0, reasons };
}
