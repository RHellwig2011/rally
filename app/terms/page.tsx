import Link from "next/link";
import { Navigation } from "@/components/Navigation";

export const metadata = {
  title: "Terms of Service - Bleacher Backers",
  description: "Terms of Service for the Bleacher Backers fundraising platform.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <section className="bg-primary text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Terms of Service</h1>
          <p className="text-lg text-primary-100">Last updated: July 2026</p>
        </div>
      </section>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="space-y-10">
          <section>
            <h2 className="text-2xl font-bold text-foreground mb-3">1. Acceptance of Terms</h2>
            <p className="text-foreground leading-relaxed">
              By creating an account or using Bleacher Backers, you agree to these Terms of
              Service. If you are using the platform on behalf of a team, club, school group,
              or other organization, you confirm that you are authorized to do so. If you do
              not agree with these terms, please do not use the platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-3">2. The Service</h2>
            <p className="text-foreground leading-relaxed">
              Bleacher Backers is an online fundraising platform that helps youth teams and
              community groups create campaigns, collect donations, and track progress toward
              their goals. We provide the tools; campaign organizers are responsible for the
              accuracy of their campaign content and the appropriate use of funds raised.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-3">3. Accounts and Eligibility</h2>
            <p className="text-foreground leading-relaxed">
              You must provide accurate information when creating an account and keep your
              login credentials secure. Campaign leaders must be adults. Player participants
              under the age of majority must have consent from a parent or guardian, and
              guardian accounts exist to provide that oversight.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-3">4. Donations and Payments</h2>
            <p className="text-foreground leading-relaxed">
              Donations are processed by our third-party payment processor. Donations are
              voluntary contributions to the campaign you select and, unless otherwise stated
              by the organizer, are not tax-deductible charitable gifts. Platform and payment
              processing fees may be deducted from donations as disclosed at the time of
              donation. Refunds are handled case by case — contact us if you believe a
              donation was made in error.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-3">5. Acceptable Use</h2>
            <p className="text-foreground leading-relaxed">
              You agree not to use Bleacher Backers for anything unlawful, misleading, or
              harmful — including fraudulent campaigns, misrepresenting how funds will be
              used, harassment, or attempting to interfere with the security or operation of
              the platform. We may suspend or remove accounts and campaigns that violate
              these terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-3">6. Disbursements</h2>
            <p className="text-foreground leading-relaxed">
              Funds raised are disbursed to the campaign organizer&apos;s verified account after
              review. We may withhold or delay disbursements while we investigate suspected
              fraud, chargebacks, or violations of these terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-3">7. Disclaimers and Liability</h2>
            <p className="text-foreground leading-relaxed">
              The platform is provided on an &quot;as is&quot; basis. To the fullest extent
              permitted by law, Bleacher Backers disclaims all warranties and is not liable
              for indirect or consequential damages arising from use of the platform, or for
              the conduct of campaign organizers or donors.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-3">8. Changes to These Terms</h2>
            <p className="text-foreground leading-relaxed">
              We may update these terms from time to time. If we make material changes, we
              will notify account holders by email or through the platform. Continued use
              after changes take effect constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-3">9. Contact</h2>
            <p className="text-foreground leading-relaxed">
              Questions about these terms? Reach out through our{" "}
              <Link href="/help" className="text-primary hover:underline">
                Help Center
              </Link>
              . You can also review our{" "}
              <Link href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </section>
        </div>

        <div className="mt-14 border-t border-border pt-8 text-center">
          <Link href="/" className="text-primary font-semibold hover:underline">
            &larr; Back to Home
          </Link>
        </div>
      </main>
    </div>
  );
}
