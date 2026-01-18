import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Video, CheckCircle, AlertTriangle, Sparkles, LogOut, User } from 'lucide-react';
import VideoChat from './components/VideoChat';
import VerificationUpload from './components/VerificationUpload';
import ResultsDashboard from './components/ResultsDashboard';
import Dashboard from './components/Dashboard';
import Auth from './components/Auth';
import { AuthProvider, useAuth } from './context/AuthContext';
import { getProfile, healthCheck } from './services/api';

// Views
const VIEWS = {
  LANDING: 'landing',
  AUTH: 'auth',
  ENROLLMENT: 'enrollment',
  DASHBOARD: 'dashboard',
  VERIFICATION: 'verification',
  RESULTS: 'results',
};

function AppContent() {
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const userId = user?.userId ?? user?.user_id;
  const [currentView, setCurrentView] = useState(VIEWS.LANDING);
  const [profile, setProfile] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [isBackendHealthy, setIsBackendHealthy] = useState(null);

  // Check backend health on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        await healthCheck();
        setIsBackendHealthy(true);
      } catch (err) {
        console.error('Backend health check failed:', err);
        setIsBackendHealthy(false);
      }
    };
    checkHealth();
  }, []);

  // Load profile if user is authenticated
  useEffect(() => {
    const loadProfile = async () => {
      if (isAuthenticated && userId) {
        try {
          const data = await getProfile(userId);
          setProfile(data);
          // If user has a profile, go to dashboard (unless on landing)
          if (data.strength_score > 0 && currentView === VIEWS.LANDING) {
            setCurrentView(VIEWS.DASHBOARD);
          }
        } catch (err) {
          console.error('Error loading profile:', err);
        }
      }
    };
    loadProfile();
  }, [isAuthenticated, userId]);

  // Handle "Get Started" click
  const handleGetStarted = () => {
    if (isAuthenticated) {
      // Already logged in, go to enrollment
      setCurrentView(VIEWS.ENROLLMENT);
    } else {
      // Need to sign in first
      setCurrentView(VIEWS.AUTH);
    }
  };

  // Called when auth is complete (from Auth component)
  const handleAuthComplete = () => {
    // After auth, go to enrollment
    setCurrentView(VIEWS.ENROLLMENT);
  };

  const handleEnrollmentComplete = async (newUserId) => {
    try {
      const data = await getProfile(newUserId || userId);
      setProfile(data);
    } catch (err) {
      console.error('Error loading profile after enrollment:', err);
    }
    setCurrentView(VIEWS.DASHBOARD);
  };

  const handleVerificationComplete = (result) => {
    setVerificationResult(result);
    setCurrentView(VIEWS.RESULTS);
  };

  const handleBackToHome = () => {
    setVerificationResult(null);
    setCurrentView(VIEWS.DASHBOARD);
  };

  const handleLogout = async () => {
    await logout();
    setProfile(null);
    setCurrentView(VIEWS.LANDING);
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-apple-dark flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-apple-blue border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Ambient gradient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-apple-blue/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-apple-purple/10 rounded-full blur-[100px]" />
      </div>

      {/* Navigation */}
      <nav className="nav-apple fixed top-0 left-0 right-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <button
            onClick={() => setCurrentView(isAuthenticated && profile?.strength_score > 0 ? VIEWS.DASHBOARD : VIEWS.LANDING)}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-apple-blue to-apple-indigo flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-[17px] font-semibold text-white">IdentityShield</span>
          </button>

          <div className="flex items-center gap-4">
            {isBackendHealthy === false && (
              <span className="text-apple-red text-sm flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span className="hidden sm:inline">Backend offline</span>
              </span>
            )}

            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentView(VIEWS.DASHBOARD)}
                  className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-300">
                    {user?.name || user?.email?.split('@')[0] || 'User'}
                  </span>
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-gray-400 hover:text-white text-sm font-medium transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCurrentView(VIEWS.AUTH)}
                className="text-gray-400 hover:text-white text-sm font-medium transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 pt-14">
        <AnimatePresence mode="wait">
          {/* Landing Page */}
          {currentView === VIEWS.LANDING && (
            <motion.div
              key="landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="min-h-[calc(100vh-56px)] flex flex-col"
            >
              {/* Hero Section */}
              <section className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="mb-8"
                >
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8">
                    <Sparkles className="w-4 h-4 text-apple-blue" />
                    <span className="text-sm text-gray-300">AI-Powered Protection</span>
                  </div>
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="hero-headline text-white mb-6 max-w-4xl"
                >
                  Protect your{' '}
                  <span className="text-gradient">digital identity</span>
                  <br />from deepfakes.
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="hero-subheadline mb-10 max-w-2xl"
                >
                  IdentityShield learns your unique voice, face, and expressions through
                  a natural conversation, then uses AI to detect synthetic media of you.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="flex flex-col sm:flex-row gap-4"
                >
                  <button
                    onClick={handleGetStarted}
                    disabled={isBackendHealthy === false}
                    className="btn-apple text-lg px-8 py-4"
                  >
                    <Video className="w-5 h-5" />
                    Get Started
                  </button>
                  <a
                    href="#features"
                    className="btn-secondary-apple text-lg px-8 py-4"
                  >
                    Learn More
                  </a>
                </motion.div>
              </section>

              {/* Features Section */}
              <section id="features" className="px-6 py-24 border-t border-white/5">
                <div className="max-w-5xl mx-auto">
                  <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    className="text-center mb-16"
                  >
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                      How it works
                    </h2>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                      Three simple steps to protect yourself from synthetic media
                    </p>
                  </motion.div>

                  <div className="grid md:grid-cols-3 gap-8">
                    {[
                      {
                        icon: Video,
                        title: 'Natural Conversation',
                        description: 'Have a 5-minute chat with our AI while we capture your unique characteristics',
                        color: 'from-apple-blue/20 to-apple-teal/20',
                      },
                      {
                        icon: Shield,
                        title: 'Identity Fingerprint',
                        description: 'We analyze your voice patterns, facial expressions, and lip-sync timing',
                        color: 'from-apple-purple/20 to-apple-pink/20',
                      },
                      {
                        icon: CheckCircle,
                        title: 'Verify Content',
                        description: 'Upload any video to check if it\'s authentically you or a synthetic fake',
                        color: 'from-apple-green/20 to-apple-teal/20',
                      },
                    ].map((feature, index) => (
                      <motion.div
                        key={feature.title}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: index * 0.1 }}
                        className="feature-card group"
                      >
                        <div className={`feature-icon bg-gradient-to-br ${feature.color}`}>
                          <feature.icon className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">
                          {feature.title}
                        </h3>
                        <p className="text-gray-400 leading-relaxed">
                          {feature.description}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Footer */}
              <footer className="px-6 py-8 border-t border-white/5">
                <div className="max-w-5xl mx-auto text-center">
                  <p className="text-sm text-gray-500">
                    IdentityShield — AI-Powered Deepfake Detection
                  </p>
                </div>
              </footer>
            </motion.div>
          )}

          {/* Auth View */}
          {currentView === VIEWS.AUTH && (
            <motion.div
              key="auth"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Auth
                onComplete={handleAuthComplete}
                onBack={() => setCurrentView(VIEWS.LANDING)}
              />
            </motion.div>
          )}

          {/* Enrollment View */}
          {currentView === VIEWS.ENROLLMENT && (
            <motion.div
              key="enrollment"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="min-h-[calc(100vh-56px)] px-6 py-8"
            >
              <VideoChat
                userId={userId}
                onComplete={handleEnrollmentComplete}
                onCancel={() => setCurrentView(profile?.strength_score > 0 ? VIEWS.DASHBOARD : VIEWS.LANDING)}
              />
            </motion.div>
          )}

          {/* Dashboard View */}
          {currentView === VIEWS.DASHBOARD && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="min-h-[calc(100vh-56px)] px-6"
            >
              <Dashboard
                user={user}
                profile={profile}
                onVerify={() => setCurrentView(VIEWS.VERIFICATION)}
                onStrengthen={() => setCurrentView(VIEWS.ENROLLMENT)}
              />
            </motion.div>
          )}

          {/* Verification Upload View */}
          {currentView === VIEWS.VERIFICATION && (
            <motion.div
              key="verification"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="min-h-[calc(100vh-56px)] px-6 py-8"
            >
              <VerificationUpload
                userId={userId}
                onComplete={handleVerificationComplete}
                onCancel={() => setCurrentView(VIEWS.DASHBOARD)}
              />
            </motion.div>
          )}

          {/* Results View */}
          {currentView === VIEWS.RESULTS && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="min-h-[calc(100vh-56px)] px-6 py-8"
            >
              <ResultsDashboard
                result={verificationResult}
                onBack={handleBackToHome}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
