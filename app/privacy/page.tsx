import Link from "next/link";
import { Navigation } from "@/components/Navigation";

export const metadata = {
  title: "Privacy Policy - Bleacher Backers",
  description: "Privacy Policy for the Bleacher Backers fundraising platform.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <section className="bg-primary text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Privacy Policy</h1>
          <p className="text-lg text-primary-100">Last updated: July 2026</p>
        </div>
      </section>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="space-y-10">
          <section>
            <h2 className="text-2xl font-bold text-foreground mb-3">1. What We Collect</h2>
            <p className="text-foreground leading-relaxed">
              We collect the information you give us when you create an account or run a
              campaign — name, email address, phone number, and campaign details. When you
              donate, we collect your name, email, and donation amount; payment card details
              are handled directly by our payment processor and never touch our servers. We
              also collect basic usage data (such as pages visited and device information) to
              keep the platform secure and improve it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-3">2. How We Use It</h2>
            <p className="text-foreground leading-relaxed">
              We use your information to operate campaigns, process donations, send receipts
              and campaign updates, prevent fraud, and provide support. If you opt in, we may
              send you product updates — you can unsubscribe at any time.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-3">3. What We Share</h2>
            <p className="text-foreground leading-relaxed">
              We never sell your personal information. We share data only with service
              providers who help us run the platform (payment processing, email delivery),
              with campaign organizers (donors&apos; names and messages, unless you choose to
              donate anonymously), and when required by law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-3">4. Children&apos;s Privacy</h2>
            <p className="text-foreground leading-relaxed">
              Bleacher Backers supports youth team fundraising, and we take minors&apos;
              privacy seriously. Player profiles for minors are created and managed with
              parent or guardian consent, we collect only the minimum information needed to
              run the campaign, and guardians can review or request deletion of their
              child&apos;s information at any time.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-3">5. Security and Retention</h2>
            <p className="text-foreground leading-relaxed">
              We protect your data with encryption in transit, secure authentication, and
              access controls. We keep personal information only as long as needed to provide
              the service and meet legal obligations (such as financial record-keeping), then
              delete or anonymize it.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-3">6. Your Choices</h2>
            <p className="text-foreground leading-relaxed">
              You can access and update your account information at any time, request a copy
              of your data, or ask us to delete your account. Donors can choose to appear
              anonymously on campaign pages. To exercise any of these rights, contact us
              through the Help Center.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-3">7. Changes to This Policy</h2>
            <p className="text-foreground leading-relaxed">
              If we make material changes to this policy, we will notify account holders by
              email or through the platform before the changes take effect.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-foreground mb-3">8. Contact</h2>
            <p className="text-foreground leading-relaxed">
              Questions about privacy? Reach out through our{" "}
              <Link href="/help" className="text-primary hover:underline">
                Help Center
              </Link>
              . You can also review our{" "}
              <Link href="/terms" className="text-primary hover:underline">
                Terms of Service
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
