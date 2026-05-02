import Link from "next/link";
import { ArrowRight, Heart, Users, Sparkles, Target, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navigation } from "@/components/Navigation";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navigation />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-600 via-primary-700 to-purple-800 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              Fundraising Shouldn't Be This Hard
            </h1>
            <p className="text-xl md:text-2xl text-indigo-100 mb-8">
              So we built Bleacher Backers to make it ridiculously easy for youth teams, clubs,
              and school groups to raise money and achieve their dreams.
            </p>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-block bg-primary-100 text-primary font-semibold px-4 py-2 rounded-full mb-4">
              Our Mission
            </div>
            <h2 className="text-4xl font-bold text-gray-900 mb-6">
              Every kid deserves a chance to play, learn, and grow
            </h2>
            <p className="text-lg text-gray-700 mb-6 leading-relaxed">
              We started Bleacher Backers because we saw too many talented kids miss out on opportunities
              simply because fundraising was too complicated, time-consuming, or expensive.
            </p>
            <p className="text-lg text-gray-700 mb-6 leading-relaxed">
              Traditional fundraising meant bake sales, door-to-door candy sales, and
              awkward donation requests. Coaches and parents spent countless hours managing
              spreadsheets, counting cash, and chasing down receipts.
            </p>
            <p className="text-lg text-gray-700 mb-6 leading-relaxed">
              <strong>There had to be a better way.</strong>
            </p>
            <p className="text-lg text-gray-700 leading-relaxed">
              So we built Bleacher Backers—a modern fundraising platform that combines AI-powered outreach,
              secure banking, and real-time tracking to help teams reach their goals faster than ever before.
            </p>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-200 to-secondary-200 rounded-3xl transform rotate-3"></div>
            <div className="relative bg-white rounded-2xl shadow-2xl p-8 border-4 border-primary-100">
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary mb-2">$2.5M+</div>
                  <div className="text-sm text-gray-600">Total Raised</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary mb-2">500+</div>
                  <div className="text-sm text-gray-600">Teams Helped</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary mb-2">15K+</div>
                  <div className="text-sm text-gray-600">Happy Donors</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-primary mb-2">98%</div>
                  <div className="text-sm text-gray-600">Success Rate</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">What We Stand For</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our values guide everything we do—from product decisions to customer support
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Value 1 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-primary-100 rounded-xl flex items-center justify-center mb-6">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Simplicity First</h3>
              <p className="text-gray-700 leading-relaxed">
                Fundraising should be simple enough for a 12-year-old to launch a campaign.
                If it's complicated, we redesign it. No exceptions.
              </p>
            </div>

            {/* Value 2 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-secondary-100 rounded-xl flex items-center justify-center mb-6">
                <Shield className="w-8 h-8 text-secondary" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Trust & Transparency</h3>
              <p className="text-gray-700 leading-relaxed">
                Every penny is tracked. Every fee is clear. No hidden charges, no surprises.
                Donors and teams deserve complete transparency.
              </p>
            </div>

            {/* Value 3 */}
            <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-success-light rounded-xl flex items-center justify-center mb-6">
                <Heart className="w-8 h-8 text-success" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Kids Come First</h3>
              <p className="text-gray-700 leading-relaxed">
                Every feature we build, every decision we make—we ask: "Does this help more
                kids participate?" If not, we don't do it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How We're Different */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">How Bleacher Backers Is Different</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            We're not just another fundraising platform. We're building the future of youth fundraising.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Feature 1 */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">AI-Powered Outreach</h3>
              <p className="text-gray-700">
                No other platform has AI that writes personalized messages for you. Click once,
                get a perfect message. Send to hundreds in seconds.
              </p>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Built-In Banking</h3>
              <p className="text-gray-700">
                Funds go directly into a secure campaign account. No waiting for payouts,
                no complicated transfers. Just simple, transparent banking.
              </p>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-success rounded-xl flex items-center justify-center flex-shrink-0">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">5-Minute Setup</h3>
              <p className="text-gray-700">
                From signup to live campaign in 5 minutes. No approval delays, no paperwork,
                no waiting. Just answer a few questions and go.
              </p>
            </div>
          </div>

          {/* Feature 4 */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Individual Tracking</h3>
              <p className="text-gray-700">
                Every team member gets their own link and dashboard. See exactly who raised what.
                Gamify fundraising and watch the competition boost donations.
              </p>
            </div>
          </div>

          {/* Feature 5 */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-secondary rounded-xl flex items-center justify-center flex-shrink-0">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Real-Time Updates</h3>
              <p className="text-gray-700">
                Watch donations roll in live. Get instant notifications. Share updates with
                supporters. Everything happens in real-time.
              </p>
            </div>
          </div>

          {/* Feature 6 */}
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-success rounded-xl flex items-center justify-center flex-shrink-0">
              <Heart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">We Actually Care</h3>
              <p className="text-gray-700">
                Real humans answer support emails. We respond in hours, not days.
                Your success is our success.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="bg-gradient-to-br from-gray-900 to-gray-800 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Our Story</h2>
          </div>

          <div className="space-y-6 text-lg text-gray-300 leading-relaxed">
            <p>
              Bleacher Backers started when our founder, a former high school coach, watched talented athletes
              miss tournaments because their team couldn't raise enough money. The fundraising process
              was stuck in the 1990s—spreadsheets, cash counting, and endless phone calls.
            </p>
            <p>
              Meanwhile, parents were writing checks, kids were selling candy bars nobody wanted,
              and coaches were spending evenings doing bookkeeping instead of planning practices.
            </p>
            <p className="text-xl font-semibold text-white">
              "There has to be a better way," we thought.
            </p>
            <p>
              So we built it. Bleacher Backers combines modern fintech, AI, and beautiful design to create
              the fundraising platform we wish existed when we were coaching. A platform where:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Campaigns launch in 5 minutes, not 5 days</li>
              <li>AI writes your outreach messages for you</li>
              <li>Funds are tracked transparently in real-time</li>
              <li>Banking is built-in, not bolted on</li>
              <li>Kids can manage their own fundraising efforts</li>
            </ul>
            <p>
              Today, Bleacher Backers powers fundraising for hundreds of teams across the country.
              We've helped raise millions of dollars, and we're just getting started.
            </p>
            <p className="text-xl font-semibold text-white">
              Because every kid deserves a chance to play, learn, and grow—regardless of their
              family's ability to fundraise.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-r from-primary-600 to-purple-700 rounded-3xl p-12 text-center text-white">
          <h2 className="text-4xl font-bold mb-4">Ready to Transform Your Fundraising?</h2>
          <p className="text-xl text-indigo-100 mb-8 max-w-2xl mx-auto">
            Join hundreds of teams that are raising more money in less time with Bleacher Backers
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" asChild>
              <Link href="/create-campaign">
                Start Your Campaign
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="bg-white/10 border-white text-white hover:bg-white/20">
              <Link href="/campaigns">
                Browse Campaigns
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center text-sm text-gray-600">
            <p>&copy; {new Date().getFullYear()} Bleacher Backers. All rights reserved. We never sell or share your data.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
