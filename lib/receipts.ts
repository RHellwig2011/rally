/**
 * H4: resolve the org identity a donation receipt may claim deductibility
 * under. Deductibility hangs off the campaign's Program (the persistent
 * legal entity), never off the season. Returns nulls when the program has no
 * verified 501(c)(3) identity on file — sendDonationReceipt then omits the
 * deductibility claim.
 */
import prisma from "@/lib/prisma";

export async function getReceiptTaxIdentity(campaignId: string): Promise<{
  taxDeductible: boolean;
  orgLegalName: string | null;
  ein: string | null;
}> {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        program: {
          select: { isTaxExempt: true, legalName: true, ein: true },
        },
      },
    });
    const program = campaign?.program;
    if (program?.isTaxExempt && program.legalName && program.ein) {
      return {
        taxDeductible: true,
        orgLegalName: program.legalName,
        ein: program.ein,
      };
    }
  } catch (error) {
    // A receipt without the deductibility claim is always safe to send.
    console.error("Failed to resolve receipt tax identity:", error);
  }
  return { taxDeductible: false, orgLegalName: null, ein: null };
}
