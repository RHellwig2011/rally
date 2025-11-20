import Link from "next/link";
import { ArrowRight, Target, CreditCard, BarChart3, Wallet } from "lucide-react";
import { Navigation } from "@/components/Navigation";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Navigation */}
      <Navigation />

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-block mb-6 px-4 py-2 bg-primary-50 rounded-full">
            <span className="text-primary font-semibold text-sm">🚀 Fundraising Made Simple</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Fundraising Reimagined for
            <span className="text-primary block mt-2 bg-gradient-to-r from-primary to-primary-700 bg-clip-text text-transparent">
              Youth Teams, Clubs, and School Groups
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Integrated banking • Real-time tracking • Automated outreach
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/create-campaign"
              className="bg-primary text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-primary-600 transition-colors flex items-center justify-center gap-2"
            >
              Start Your Campaign
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="#how-it-works"
              className="border-2 border-primary text-primary px-8 py-4 rounded-lg text-lg font-semibold hover:bg-primary-50 transition-colors"
            >
              See How It Works
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Everything You Need to Succeed
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            From launch to goal completion, Rally provides all the tools your team needs
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="group bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-primary-200 transition-all duration-300 cursor-pointer">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary group-hover:scale-110 transition-all duration-300">
              <Target className="w-6 h-6 text-primary group-hover:text-white transition-colors duration-300" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Set Goal</h3>
            <p className="text-gray-600">
              Create your campaign in minutes with customizable branding and goals
            </p>
          </div>

          <div className="group bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-secondary-200 transition-all duration-300 cursor-pointer">
            <div className="w-12 h-12 bg-secondary-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-secondary group-hover:scale-110 transition-all duration-300">
              <CreditCard className="w-6 h-6 text-secondary group-hover:text-white transition-colors duration-300" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Raise</h3>
            <p className="text-gray-600">
              Automated outreach and referral links boost donor engagement
            </p>
          </div>

          <div className="group bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-success/30 transition-all duration-300 cursor-pointer">
            <div className="w-12 h-12 bg-success-light rounded-lg flex items-center justify-center mb-4 group-hover:bg-success group-hover:scale-110 transition-all duration-300">
              <BarChart3 className="w-6 h-6 text-success group-hover:text-white transition-colors duration-300" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Track</h3>
            <p className="text-gray-600">
              Real-time dashboard with transparent reporting and analytics
            </p>
          </div>

          <div className="group bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-lg hover:border-primary-200 transition-all duration-300 cursor-pointer">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary group-hover:scale-110 transition-all duration-300">
              <Wallet className="w-6 h-6 text-primary group-hover:text-white transition-colors duration-300" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Spend</h3>
            <p className="text-gray-600">
              Built-in banking for secure fund storage and easy payouts
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-white rounded-2xl shadow-lg p-12 border border-gray-100">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl md:text-5xl font-bold text-primary mb-2">$2.5M+</div>
              <div className="text-gray-600 font-medium">Total Raised</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-primary mb-2">500+</div>
              <div className="text-gray-600 font-medium">Active Teams</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-primary mb-2">15K+</div>
              <div className="text-gray-600 font-medium">Donors</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-primary mb-2">98%</div>
              <div className="text-gray-600 font-medium">Success Rate</div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-2xl p-12 text-center text-white shadow-xl">
          <h2 className="text-3xl font-bold mb-4">Why Teams Choose Rally</h2>
          <blockquote className="text-xl italic mb-4">
            "Raised $15K in 3 weeks. The banking dashboard made spending transparent for parents."
          </blockquote>
          <p className="text-primary-100">- Sarah T., Volleyball Coach</p>
        </div>
      </section>

      {/* Transparent Pricing */}
      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Transparent Pricing
          </h2>
          <p className="text-xl text-gray-600">
            Simple, honest pricing with no hidden fees
          </p>
        </div>
        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
          <div className="text-center mb-6">
            <div className="text-5xl font-bold text-primary mb-2">10%</div>
            <p className="text-gray-600">Platform Fee</p>
          </div>
          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-success rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-gray-700">Secure banking infrastructure</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-success rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-gray-700">Unlimited campaign updates</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-success rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-gray-700">Automated email & SMS outreach</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-success rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-gray-700">24/7 support for campaigns</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-success rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-gray-700">Real-time analytics dashboard</span>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">Example Breakdown:</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Donor contributes:</span>
                <span className="font-semibold">$100.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Platform fee (10%):</span>
                <span className="text-gray-600">$10.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Processing fee (~3%):</span>
                <span className="text-gray-600">$3.00</span>
              </div>
              <div className="border-t pt-2 flex justify-between">
                <span className="text-gray-900 font-semibold">To your campaign:</span>
                <span className="text-success font-bold">$87.00</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gray-900 rounded-2xl p-12 text-center text-white">
          <h2 className="text-4xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl text-gray-300 mb-8">
            Join hundreds of teams already fundraising smarter with Rally
          </p>
          <Link
            href="/create-campaign"
            className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-primary-600 transition-colors"
          >
            Create Your Campaign
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg">R</span>
                </div>
                <span className="text-2xl font-bold text-gray-900">Rally</span>
              </div>
              <p className="text-gray-600 text-sm">
                Fundraising reimagined for youth teams, clubs, and school groups.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link href="#features">Features</Link></li>
                <li><Link href="#pricing">Pricing</Link></li>
                <li><Link href="/campaigns">Browse Campaigns</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link href="/about">About</Link></li>
                <li><Link href="/privacy">Privacy Policy</Link></li>
                <li><Link href="/terms">Terms of Service</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link href="/help">Help Center</Link></li>
                <li><Link href="/contact">Contact Us</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 text-center text-sm text-gray-600">
            <p>&copy; {new Date().getFullYear()} Rally. All rights reserved. We never sell or share your data.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
