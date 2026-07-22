import Link from "next/link";
import { ArrowRight, Target, CreditCard, BarChart3, Wallet, Sparkles, Mail, MessageSquare, Zap, Users, CheckCircle } from "lucide-react";
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
          <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
            Fundraising Reimagined for
            <span className="text-primary block mt-2 bg-gradient-to-r from-primary to-primary-700 bg-clip-text text-transparent">
              Youth Teams, Clubs, and School Groups
            </span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
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

      {/* How It Works Section */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 bg-white">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Fundraising Made <span className="text-primary">Ridiculously Easy</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            From setup to success in minutes, not weeks. Watch your campaign soar with AI-powered outreach.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {/* Step 1 */}
          <div className="relative">
            <div className="absolute -top-4 -left-4 w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
              1
            </div>
            <div className="bg-gradient-to-br from-primary-50 to-white p-8 rounded-2xl border-2 border-primary-100 h-full">
              <div className="w-16 h-16 bg-primary rounded-xl flex items-center justify-center mb-4">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-3">Create in 5 Minutes</h3>
              <p className="text-foreground mb-4">
                Set your goal, add team details, and upload your logo. Our smart setup wizard handles the rest.
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <span>Customizable campaign page</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <span>Team roster import (CSV or manual)</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <span>Instant fundraising links</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Step 2 */}
          <div className="relative">
            <div className="absolute -top-4 -left-4 w-12 h-12 bg-secondary rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
              2
            </div>
            <div className="bg-gradient-to-br from-secondary-50 to-white p-8 rounded-2xl border-2 border-secondary-100 h-full">
              <div className="w-16 h-16 bg-secondary rounded-xl flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-3">AI Does the Outreach</h3>
              <p className="text-foreground mb-4">
                Let AI write heartfelt messages. Send mass emails & texts with one click. No marketing skills needed.
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <span>AI-generated personalized messages</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <span>Bulk email & SMS to hundreds</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <span>Track who clicks & donates</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Step 3 */}
          <div className="relative">
            <div className="absolute -top-4 -left-4 w-12 h-12 bg-success rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
              3
            </div>
            <div className="bg-gradient-to-br from-green-50 to-white p-8 rounded-2xl border-2 border-success h-full">
              <div className="w-16 h-16 bg-success rounded-xl flex items-center justify-center mb-4">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-3">Watch It Grow</h3>
              <p className="text-foreground mb-4">
                Real-time dashboard shows every donation. Built-in banking keeps funds secure until you need them.
              </p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <span>Live donation notifications</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <span>Individual player tracking</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <span>One-click payouts to your account</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="text-center">
          <Link
            href="/create-campaign"
            className="inline-flex items-center gap-2 bg-primary text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-primary-600 transition-colors shadow-lg hover:shadow-xl"
          >
            Start Your Free Campaign
            <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="text-sm text-muted-foreground mt-4">No credit card required • Takes 5 minutes</p>
        </div>
      </section>

      {/* AI Features Showcase */}
      <section className="bg-gradient-to-br from-indigo-600 to-purple-700 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
              <Sparkles className="w-5 h-5 text-yellow-300" />
              <span className="text-white font-semibold">Powered by AI</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Your AI Fundraising Assistant
            </h2>
            <p className="text-xl text-primary-100 max-w-3xl mx-auto">
              Stop staring at blank screens. Let AI write compelling messages that actually get responses.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Feature 1: AI Message Generation */}
            <div className="bg-white rounded-2xl p-8 shadow-2xl">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">AI-Generated Messages</h3>
                  <p className="text-muted-foreground">Click once, get perfect messages instantly</p>
                </div>
              </div>

              <div className="bg-muted rounded-xl p-6 mb-4 border-2 border-border">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">AI Generated Email</span>
                  <Sparkles className="w-4 h-4 text-yellow-500" />
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Subject:</p>
                    <p className="font-semibold text-foreground">Help Sarah Reach Her Soccer Dreams! ⚽</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Message:</p>
                    <p className="text-sm text-foreground italic leading-relaxed">
                      "Hi! I'm Sarah and I'm raising money for our soccer team's tournament trip.
                      We've already raised $450 of our $1,000 goal! Every donation helps us compete
                      and grow as a team. Would you consider supporting us?"
                    </p>
                  </div>
                </div>
              </div>

              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-foreground">
                  <div className="w-6 h-6 bg-success rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <span>Choose tone: Friendly, Enthusiastic, or Heartfelt</span>
                </li>
                <li className="flex items-center gap-3 text-foreground">
                  <div className="w-6 h-6 bg-success rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <span>Auto-includes campaign stats & fundraising link</span>
                </li>
                <li className="flex items-center gap-3 text-foreground">
                  <div className="w-6 h-6 bg-success rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <span>Edit and personalize before sending</span>
                </li>
              </ul>
            </div>

            {/* Feature 2: Mass Outreach */}
            <div className="bg-white rounded-2xl p-8 shadow-2xl">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-secondary to-secondary-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-foreground mb-2">Mass Email & SMS</h3>
                  <p className="text-muted-foreground">Reach hundreds with one click</p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-secondary-50 to-purple-50 rounded-xl p-6 mb-4 border-2 border-secondary-200">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Outreach Dashboard</span>
                  <span className="text-xs bg-success-light text-success px-2 py-1 rounded-full font-semibold">Ready to Send</span>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-white rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-primary">245</p>
                    <p className="text-xs text-muted-foreground">Contacts</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-secondary">89%</p>
                    <p className="text-xs text-muted-foreground">Open Rate</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-success">$3.2K</p>
                    <p className="text-xs text-muted-foreground">Raised</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 bg-primary text-white py-2 px-4 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
                    <Mail className="w-4 h-4" />
                    Send Email
                  </button>
                  <button className="flex-1 bg-secondary text-white py-2 px-4 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Send SMS
                  </button>
                </div>
              </div>

              <ul className="space-y-3">
                <li className="flex items-center gap-3 text-foreground">
                  <div className="w-6 h-6 bg-success rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <span>Import contacts from CSV or add manually</span>
                </li>
                <li className="flex items-center gap-3 text-foreground">
                  <div className="w-6 h-6 bg-success rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <span>Personalize each message with names</span>
                </li>
                <li className="flex items-center gap-3 text-foreground">
                  <div className="w-6 h-6 bg-success rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                  <span>Track opens, clicks, and donations</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="text-center mt-12">
            <p className="text-primary-100 text-lg mb-4">
              <strong className="text-white">Pro tip:</strong> Most campaigns see 3x more donations with AI-powered outreach
            </p>
          </div>
        </div>
      </section>

      {/* Shareable Content Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Share Anywhere, Anytime
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Beautiful shareable posters and social media graphics—generated automatically for your campaign
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Preview */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary-200 to-secondary-200 rounded-3xl transform rotate-3"></div>
            <div className="relative bg-white rounded-2xl shadow-2xl p-8 border-4 border-primary-100">
              {/* Mock Poster */}
              <div className="bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl p-8 text-white text-center">
                <div className="w-20 h-20 bg-white rounded-full mx-auto mb-4 flex items-center justify-center">
                  <span className="text-4xl">⚽</span>
                </div>
                <h3 className="text-3xl font-bold mb-2">Support Our Team!</h3>
                <p className="text-lg mb-4 text-primary-100">Lincoln High Soccer</p>
                <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 mb-4">
                  <p className="text-4xl font-bold mb-1">$4,250</p>
                  <p className="text-sm text-primary-100">raised of $10,000 goal</p>
                  <div className="w-full bg-white/30 rounded-full h-2 mt-3">
                    <div className="bg-white rounded-full h-2" style={{width: '42%'}}></div>
                  </div>
                </div>
                <p className="text-sm mb-4">Help us get to the state championship!</p>
                <div className="bg-white text-primary-700 py-2 px-4 rounded-lg font-bold inline-block">
                  bleacherbackers.com/lincoln-soccer
                </div>
              </div>
              <div className="mt-4 flex gap-2 justify-center">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xs">fb</span>
                </div>
                <div className="w-10 h-10 bg-sky-400 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xs">tw</span>
                </div>
                <div className="w-10 h-10 bg-pink-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xs">ig</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Features */}
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground mb-2">Auto-Generated Posters</h3>
                <p className="text-muted-foreground">
                  Beautiful campaign posters created automatically with your team colors, logo, and real-time stats.
                  Download and share in seconds.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-secondary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground mb-2">Player Spotlight Cards</h3>
                <p className="text-muted-foreground">
                  Each player gets their own personalized fundraising card with their photo, stats, and unique link.
                  Perfect for social media.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-success-light rounded-lg flex items-center justify-center flex-shrink-0">
                <Mail className="w-6 h-6 text-success" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground mb-2">Email-Ready Graphics</h3>
                <p className="text-muted-foreground">
                  Optimized images for email campaigns that look great on mobile and desktop. Copy and paste into any email.
                </p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-50 to-primary-50 rounded-xl p-6 border-2 border-primary-100">
              <p className="text-foreground font-semibold mb-2">
                ✨ All graphics update automatically
              </p>
              <p className="text-sm text-muted-foreground">
                As donations come in, your posters and graphics update in real-time with the latest totals.
                Always fresh, always accurate.
              </p>
            </div>

            <Link
              href="/create-campaign"
              className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors"
            >
              Try It Free
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Everything You Need to Succeed
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            From launch to goal completion, Bleacher Backers provides all the tools your team needs
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="group bg-white p-6 rounded-xl shadow-sm border border-border hover:shadow-lg hover:border-primary-200 transition-all duration-300 cursor-pointer">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary group-hover:scale-110 transition-all duration-300">
              <Target className="w-6 h-6 text-primary group-hover:text-white transition-colors duration-300" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Set Goal</h3>
            <p className="text-muted-foreground">
              Create your campaign in minutes with customizable branding and goals
            </p>
          </div>

          <div className="group bg-white p-6 rounded-xl shadow-sm border border-border hover:shadow-lg hover:border-secondary-200 transition-all duration-300 cursor-pointer">
            <div className="w-12 h-12 bg-secondary-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-secondary group-hover:scale-110 transition-all duration-300">
              <CreditCard className="w-6 h-6 text-secondary group-hover:text-white transition-colors duration-300" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Raise</h3>
            <p className="text-muted-foreground">
              Automated outreach and referral links boost donor engagement
            </p>
          </div>

          <div className="group bg-white p-6 rounded-xl shadow-sm border border-border hover:shadow-lg hover:border-success/30 transition-all duration-300 cursor-pointer">
            <div className="w-12 h-12 bg-success-light rounded-lg flex items-center justify-center mb-4 group-hover:bg-success group-hover:scale-110 transition-all duration-300">
              <BarChart3 className="w-6 h-6 text-success group-hover:text-white transition-colors duration-300" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Track</h3>
            <p className="text-muted-foreground">
              Real-time dashboard with transparent reporting and analytics
            </p>
          </div>

          <div className="group bg-white p-6 rounded-xl shadow-sm border border-border hover:shadow-lg hover:border-primary-200 transition-all duration-300 cursor-pointer">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary group-hover:scale-110 transition-all duration-300">
              <Wallet className="w-6 h-6 text-primary group-hover:text-white transition-colors duration-300" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">Spend</h3>
            <p className="text-muted-foreground">
              Built-in banking for secure fund storage and easy payouts
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-white rounded-2xl shadow-lg p-12 border border-border">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl md:text-5xl font-bold text-primary mb-2">$2.5M+</div>
              <div className="text-muted-foreground font-medium">Total Raised</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-primary mb-2">500+</div>
              <div className="text-muted-foreground font-medium">Active Teams</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-primary mb-2">15K+</div>
              <div className="text-muted-foreground font-medium">Donors</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-primary mb-2">98%</div>
              <div className="text-muted-foreground font-medium">Success Rate</div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-2xl p-12 text-center text-white shadow-xl">
          <h2 className="text-3xl font-bold mb-4">Why Teams Choose Bleacher Backers</h2>
          <blockquote className="text-xl italic mb-4">
            "Raised $15K in 3 weeks. The banking dashboard made spending transparent for parents."
          </blockquote>
          <p className="text-primary-100">- Sarah T., Volleyball Coach</p>
        </div>
      </section>

      {/* Transparent Pricing */}
      <section id="pricing" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            Transparent Pricing
          </h2>
          <p className="text-xl text-muted-foreground">
            Simple, honest pricing with no hidden fees
          </p>
        </div>
        <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-8 border border-border">
          <div className="text-center mb-6">
            <div className="text-5xl font-bold text-primary mb-2">10%</div>
            <p className="text-muted-foreground">Platform Fee</p>
          </div>
          <div className="space-y-4 mb-8">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-success rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-foreground">Secure banking infrastructure</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-success rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-foreground">Unlimited campaign updates</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-success rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-foreground">Automated email & SMS outreach</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-success rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-foreground">24/7 support for campaigns</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-success rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-foreground">Real-time analytics dashboard</span>
            </div>
          </div>
          <div className="bg-muted rounded-lg p-4">
            <h4 className="font-semibold text-foreground mb-2">Example Breakdown:</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Donor contributes:</span>
                <span className="font-semibold">$100.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platform fee (10%):</span>
                <span className="text-muted-foreground">$10.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Processing fee (2.9% + $0.30):</span>
                <span className="text-muted-foreground">$3.20</span>
              </div>
              <div className="border-t pt-2 flex justify-between">
                <span className="text-foreground font-semibold">To your campaign:</span>
                <span className="text-success font-bold">$86.80</span>
              </div>
            </div>
            <div className="space-y-2 text-sm mt-4 pt-4 border-t">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Donor contributes:</span>
                <span className="font-semibold">$25.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Platform fee (10%):</span>
                <span className="text-muted-foreground">$2.50</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Processing fee (2.9% + $0.30):</span>
                <span className="text-muted-foreground">$1.03</span>
              </div>
              <div className="border-t pt-2 flex justify-between">
                <span className="text-foreground font-semibold">To your campaign:</span>
                <span className="text-success font-bold">$21.47</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              The flat $0.30 makes processing cost a larger share of smaller gifts
              (4.1% on a $25 donation). Donors see the exact amount at checkout and
              can choose to cover the processing fee.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-foreground rounded-2xl p-12 text-center text-white">
          <h2 className="text-4xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join hundreds of teams already fundraising smarter with Bleacher Backers
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
                  <span className="text-white font-bold text-sm">BB</span>
                </div>
                <span className="text-2xl font-bold text-foreground">Bleacher Backers</span>
              </div>
              <p className="text-muted-foreground text-sm">
                Fundraising reimagined for youth teams, clubs, and school groups.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#features">Features</Link></li>
                <li><Link href="#pricing">Pricing</Link></li>
                <li><Link href="/campaigns">Browse Campaigns</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/about">About</Link></li>
                <li><Link href="/privacy">Privacy Policy</Link></li>
                <li><Link href="/terms">Terms of Service</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/help">Help Center</Link></li>
                <li><Link href="/help">Contact Us</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Bleacher Backers. All rights reserved. We never sell or share your data.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
