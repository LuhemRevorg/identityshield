import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Video, Upload, CheckCircle, AlertTriangle } from 'lucide-react';
import VideoChat from './components/VideoChat';
import VerificationUpload from './components/VerificationUpload';
import ResultsDashboard from './components/ResultsDashboard';
import ProfileStrength from './components/ProfileStrength';
import { getProfile, healthCheck } from './services/api';

// Views
const VIEWS = {
  LANDING: 'landing',
  ENROLLMENT: 'enrollment',
  DASHBOARD: 'dashboard',
  VERIFICATION: 'verification',
  RESULTS: 'results',
};

function App() {
  const [currentView, setCurrentView] = useState(VIEWS.LANDING);
  const [userId, setUserId] = useState(() => localStorage.getItem('userId'));
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

  // Load profile if user exists
  useEffect(() => {
    const loadProfile = async () => {
      if (userId) {
        try {
          const data = await getProfile(userId);
          setProfile(data);
          if (data.strength_score > 0) {
            setCurrentView(VIEWS.DASHBOARD);
          }
        } catch (err) {
          console.error('Error loading profile:', err);
          // User might not exist yet
        }
      }
    };
    loadProfile();
  }, [userId]);

  const handleEnrollmentComplete = async (newUserId) => {
    setUserId(newUserId);
    localStorage.setItem('userId', newUserId);
    try {
      const data = await getProfile(newUserId);
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

  const handleLogout = () => {
    localStorage.removeItem('userId');
    setUserId(null);
    setProfile(null);
    setCurrentView(VIEWS.LANDING);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-primary-900">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => setCurrentView(userId ? VIEWS.DASHBOARD : VIEWS.LANDING)}
          >
            <Shield className="w-8 h-8 text-primary-400" />
            <h1 className="text-xl font-bold text-white">IdentityShield</h1>
          </div>

          <div className="flex items-center gap-4">
            {isBackendHealthy === false && (
              <span className="text-red-400 text-sm flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                Backend offline
              </span>
            )}
            {userId && (
              <button
                onClick={handleLogout}
                className="text-gray-400 hover:text-white text-sm"
              >
                Reset Profile
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {/* Landing Page */}
          {currentView === VIEWS.LANDING && (
            <motion.div
              key="landing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center min-h-[70vh] text-center"
            >
              <motion.div
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2 }}
                className="w-24 h-24 bg-primary-500/20 rounded-full flex items-center justify-center mb-8"
              >
                <Shield className="w-12 h-12 text-primary-400" />
              </motion.div>

              <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Protect Your Digital Identity
              </h2>
              <p className="text-xl text-gray-400 mb-8 max-w-2xl">
                IdentityShield learns your unique voice, face, and expressions through
                a natural conversation, then uses AI to detect deepfakes of you.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <button
                  onClick={() => setCurrentView(VIEWS.ENROLLMENT)}
                  disabled={isBackendHealthy === false}
                  className="btn-primary flex items-center gap-2 text-lg"
                >
                  <Video className="w-5 h-5" />
                  Start Enrollment
                </button>
              </div>

              {/* Features */}
              <div className="grid md:grid-cols-3 gap-6 max-w-4xl">
                <div className="card bg-gray-800/50 border border-gray-700">
                  <Video className="w-8 h-8 text-primary-400 mb-3" />
                  <h3 className="text-white font-semibold mb-2">Natural Conversation</h3>
                  <p className="text-gray-400 text-sm">
                    Have a 5-minute chat with our AI while we learn your unique characteristics
                  </p>
                </div>
                <div className="card bg-gray-800/50 border border-gray-700">
                  <Shield className="w-8 h-8 text-primary-400 mb-3" />
                  <h3 className="text-white font-semibold mb-2">Identity Fingerprint</h3>
                  <p className="text-gray-400 text-sm">
                    We capture your voice patterns, facial expressions, and lip-sync timing
                  </p>
                </div>
                <div className="card bg-gray-800/50 border border-gray-700">
                  <CheckCircle className="w-8 h-8 text-primary-400 mb-3" />
                  <h3 className="text-white font-semibold mb-2">Verify Content</h3>
                  <p className="text-gray-400 text-sm">
                    Upload any video to check if it's really you or a synthetic fake
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Enrollment View */}
          {currentView === VIEWS.ENROLLMENT && (
            <motion.div
              key="enrollment"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <VideoChat
                onComplete={handleEnrollmentComplete}
                onCancel={() => setCurrentView(VIEWS.LANDING)}
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
              className="space-y-8"
            >
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">Your Identity Profile</h2>
                <p className="text-gray-400">Your unique identity fingerprint is protected</p>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                {/* Profile Strength */}
                <div className="card bg-gray-800/50 border border-gray-700">
                  <ProfileStrength profile={profile} />
                </div>

                {/* Actions */}
                <div className="card bg-gray-800/50 border border-gray-700">
                  <h3 className="text-xl font-semibold text-white mb-6">Actions</h3>
                  <div className="space-y-4">
                    <button
                      onClick={() => setCurrentView(VIEWS.VERIFICATION)}
                      className="w-full btn-primary flex items-center justify-center gap-2"
                    >
                      <Upload className="w-5 h-5" />
                      Verify Content
                    </button>
                    <button
                      onClick={() => setCurrentView(VIEWS.ENROLLMENT)}
                      className="w-full btn-secondary flex items-center justify-center gap-2"
                    >
                      <Video className="w-5 h-5" />
                      Strengthen Profile
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Verification Upload View */}
          {currentView === VIEWS.VERIFICATION && (
            <motion.div
              key="verification"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
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
            >
              <ResultsDashboard
                result={verificationResult}
                onBack={handleBackToHome}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-700 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-gray-500 text-sm">
          IdentityShield - AI-Powered Deepfake Detection
        </div>
      </footer>
    </div>
  );
}

export default App;
