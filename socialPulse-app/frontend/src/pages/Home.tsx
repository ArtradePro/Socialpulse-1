import React from 'react';
import { Link } from 'react-router-dom';
import { Bot, Zap, TrendingUp, Shield, ChevronRight, CheckCircle2 } from 'lucide-react';

export const Home: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-indigo-500/30">
      {/* Navigation */}
      <nav className="fixed w-full z-50 top-0 border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="SocialPulse Logo" className="w-8 h-8 rounded-lg object-contain bg-white" />
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400">
                SocialPulse
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Link 
                to="/login" 
                className="text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                Log In
              </Link>
              <Link 
                to="/register" 
                className="text-sm font-medium px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all border border-white/5"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Abstract Background Elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/20 rounded-full blur-[120px] opacity-50 pointer-events-none" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[100px] opacity-50 pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-medium mb-8">
            <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
            Introducing SocialPulse AI
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8">
            Social Media Management <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400">
              on Autopilot
            </span>
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-xl text-slate-400 mb-10">
            Automate your content pipeline, engage with your audience, and grow your brand effortlessly using our advanced Gemini AI integration.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link 
              to="/register" 
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-semibold rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white shadow-[0_0_40px_-10px_rgba(99,102,241,0.5)] transition-all hover:scale-105"
            >
              Get Started for Free
              <ChevronRight className="w-5 h-5" />
            </Link>
            <a 
              href="#features" 
              className="inline-flex items-center justify-center px-8 py-4 text-lg font-medium rounded-xl bg-slate-800/50 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-all backdrop-blur-sm"
            >
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-10 border-y border-white/5 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm font-medium text-slate-500 mb-6 uppercase tracking-wider">Trusted by innovative teams worldwide</p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-50 grayscale">
            {/* Placeholder Logos */}
            <div className="flex items-center gap-2 text-xl font-bold"><Zap className="w-6 h-6"/> Stark Ind.</div>
            <div className="flex items-center gap-2 text-xl font-bold"><TrendingUp className="w-6 h-6"/> Acme Corp</div>
            <div className="flex items-center gap-2 text-xl font-bold"><Shield className="w-6 h-6"/> Globex</div>
            <div className="flex items-center gap-2 text-xl font-bold"><Bot className="w-6 h-6"/> Initech</div>
          </div>
        </div>
      </section>

      {/* The Gemini Advantage */}
      <section id="features" className="py-24 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">The Gemini Advantage</h2>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto">
              Our AI doesn't just generate text; it learns your specific brand voice, ensuring every post feels authentic and tailored to your audience.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-gradient-to-b from-slate-800/50 to-slate-900/50 border border-slate-700/50 hover:border-indigo-500/50 transition-colors group">
              <div className="w-12 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Bot className="w-6 h-6 text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Brand Voice Alignment</h3>
              <p className="text-slate-400">
                Configure your unique Problem/Solution/CTA framework. Gemini remembers your style guidelines and enforces them across all generated content.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-gradient-to-b from-slate-800/50 to-slate-900/50 border border-slate-700/50 hover:border-cyan-500/50 transition-colors group">
              <div className="w-12 h-12 rounded-lg bg-cyan-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-6 h-6 text-cyan-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Smart Scheduling</h3>
              <p className="text-slate-400">
                Our predictive algorithms determine the optimal times to post for your specific audience, maximizing engagement and reach.
              </p>
            </div>

            <div className="p-8 rounded-2xl bg-gradient-to-b from-slate-800/50 to-slate-900/50 border border-slate-700/50 hover:border-purple-500/50 transition-colors group">
              <div className="w-12 h-12 rounded-lg bg-purple-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Shield className="w-6 h-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Unified Inbox</h3>
              <p className="text-slate-400">
                Manage all your social interactions in one secure place. Let AI draft responses to common queries so you can focus on strategy.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-indigo-600/10"></div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to transform your social strategy?</h2>
          <p className="text-xl text-slate-300 mb-10">
            Join thousands of marketers who are saving hours every week with SocialPulse.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 items-center">
            <Link 
              to="/register" 
              className="inline-flex items-center justify-center gap-2 px-8 py-4 text-lg font-bold rounded-xl bg-white text-slate-900 hover:bg-slate-100 shadow-xl transition-all hover:-translate-y-1"
            >
              Start Your Free Trial
            </Link>
            <p className="text-sm text-slate-400 mt-4 sm:mt-0 sm:ml-4 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-indigo-400" /> No credit card required
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/10 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="SocialPulse Logo" className="w-6 h-6 rounded bg-white object-contain" />
            <span className="text-lg font-bold text-white">SocialPulse</span>
          </div>
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} SocialPulse Inc. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-slate-400">
            <Link to="/login" className="hover:text-white transition-colors">Login</Link>
            <Link to="/register" className="hover:text-white transition-colors">Sign Up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
