import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  User,
  Mail,
  Calendar,
  Clock,
  Video,
  Upload,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Mic,
  Camera,
  Activity,
  ChevronRight,
  FileVideo,
  History,
} from 'lucide-react';
import { getEnrollmentSessions, getVerificationHistory } from '../services/api';

const Dashboard = ({ user, profile, onVerify, onStrengthen }) => {
  const [sessions, setSessions] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingVerifications, setLoadingVerifications] = useState(true);
  const userId = user?.userId ?? user?.user_id;

  useEffect(() => {
    if (userId) {
      setLoadingSessions(true);
      setLoadingVerifications(true);
      loadData(userId);
    } else {
      setLoadingSessions(false);
      setLoadingVerifications(false);
    }
  }, [userId]);

  const loadData = async (currentUserId) => {
    try {
      const [sessionsData, verificationsData] = await Promise.all([
        getEnrollmentSessions(currentUserId),
        getVerificationHistory(currentUserId, 5),
      ]);
      setSessions(sessionsData.sessions || []);
      setVerifications(verificationsData.history || []);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoadingSessions(false);
      setLoadingVerifications(false);
    }
  };

  const strengthPercent = Math.round((profile?.strength_score || 0) * 100);
  const circumference = 2 * Math.PI * 52;
  const strokeDashoffset = circumference - ((profile?.strength_score || 0) * circumference);

  const getStrengthColor = (score) => {
    if (score >= 0.7) return '#34C759';
    if (score >= 0.4) return '#FF9500';
    return '#FF3B30';
  };

  const getStrengthLabel = (score) => {
    if (score >= 0.7) return 'Strong';
    if (score >= 0.4) return 'Moderate';
    if (score > 0) return 'Weak';
    return 'Not Started';
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="max-w-6xl mx-auto py-8 space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-apple-green/20 to-apple-teal/20 flex items-center justify-center">
          <Shield className="w-10 h-10 text-apple-green" />
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
          Welcome back, {user?.name || user?.email?.split('@')[0]}
        </h1>
        <p className="text-gray-400">Your identity protection dashboard</p>
      </motion.div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - User Info & Profile Strength */}
        <div className="space-y-6">
          {/* User Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-apple-blue" />
              Account Info
            </h3>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-apple-blue to-apple-indigo flex items-center justify-center">
                  <span className="text-white font-semibold text-lg">
                    {(user?.name || user?.email || 'U')[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-white font-medium">{user?.name || 'User'}</p>
                  <p className="text-gray-400 text-sm">{user?.email}</p>
                </div>
              </div>
              <div className="pt-3 border-t border-white/10 space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Calendar className="w-4 h-4" />
                  <span>Member since {formatDate(user?.created_at)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Activity className="w-4 h-4" />
                  <span>{sessions.length} enrollment session{sessions.length !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Profile Strength Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-6">Profile Strength</h3>

            {/* Circular Progress */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                <svg className="w-36 h-36 -rotate-90">
                  <circle
                    strokeWidth="8"
                    stroke="rgba(255,255,255,0.1)"
                    fill="transparent"
                    r="52"
                    cx="72"
                    cy="72"
                  />
                  <motion.circle
                    strokeWidth="8"
                    stroke={getStrengthColor(profile?.strength_score || 0)}
                    fill="transparent"
                    r="52"
                    cx="72"
                    cy="72"
                    strokeLinecap="round"
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    style={{
                      strokeDasharray: circumference,
                      filter: `drop-shadow(0 0 10px ${getStrengthColor(profile?.strength_score || 0)}50)`,
                    }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold text-white">{strengthPercent}%</span>
                  <span
                    className="text-sm font-medium"
                    style={{ color: getStrengthColor(profile?.strength_score || 0) }}
                  >
                    {getStrengthLabel(profile?.strength_score || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Feature Bars */}
            <div className="space-y-3">
              <FeatureBar
                icon={Mic}
                label="Voice"
                value={profile?.feature_coverage?.voice || 0}
                count={profile?.total_voice_samples || 0}
              />
              <FeatureBar
                icon={Camera}
                label="Face"
                value={profile?.feature_coverage?.face || 0}
                count={profile?.total_face_samples || 0}
              />
              <FeatureBar
                icon={Activity}
                label="Sessions"
                value={profile?.feature_coverage?.sessions || 0}
                count={profile?.sessions_count || 0}
              />
            </div>

            {profile?.last_updated && (
              <div className="mt-4 pt-4 border-t border-white/10 text-sm text-gray-500 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Last updated: {formatDate(profile.last_updated)}
              </div>
            )}
          </motion.div>
        </div>

        {/* Center Column - Quick Actions & Sessions */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button
                onClick={onVerify}
                className="w-full btn-apple flex items-center justify-center gap-3 py-4"
              >
                <Upload className="w-5 h-5" />
                Verify Content
                <ChevronRight className="w-4 h-4 ml-auto" />
              </button>
              <button
                onClick={onStrengthen}
                className="w-full btn-secondary-apple flex items-center justify-center gap-3 py-4"
              >
                <Video className="w-5 h-5" />
                Strengthen Profile
                <ChevronRight className="w-4 h-4 ml-auto" />
              </button>
            </div>

            <div className="mt-4 p-4 rounded-2xl bg-apple-blue/10 border border-apple-blue/20">
              <p className="text-sm text-gray-300">
                <span className="text-apple-blue font-medium">Tip:</span> Upload a video or audio
                file to check if it's authentically you or a synthetic deepfake.
              </p>
            </div>
          </motion.div>

          {/* Enrollment Sessions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass-card p-6"
          >
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Video className="w-5 h-5 text-apple-purple" />
              Enrollment Sessions
            </h3>

            {loadingSessions ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-white/5 shimmer" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/5 flex items-center justify-center">
                  <Video className="w-6 h-6 text-gray-500" />
                </div>
                <p className="text-gray-400 text-sm">No enrollment sessions yet</p>
                <button
                  onClick={onStrengthen}
                  className="mt-3 text-apple-blue text-sm font-medium hover:underline"
                >
                  Start your first session
                </button>
              </div>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-white text-sm font-medium">
                          {formatDate(session.started_at)}
                        </p>
                        <p className="text-gray-400 text-xs">
                          {formatTime(session.started_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1.5">
                          {session.completed_at ? (
                            <CheckCircle className="w-4 h-4 text-apple-green" />
                          ) : (
                            <AlertTriangle className="w-4 h-4 text-apple-orange" />
                          )}
                          <span className={`text-xs font-medium ${session.completed_at ? 'text-apple-green' : 'text-apple-orange'}`}>
                            {session.completed_at ? 'Completed' : 'In Progress'}
                          </span>
                        </div>
                        <p className="text-gray-500 text-xs mt-0.5">
                          {formatDuration(session.duration_seconds)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Right Column - Verification History */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-card p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-apple-teal" />
            Verification History
          </h3>

          {loadingVerifications ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-white/5 shimmer" />
              ))}
            </div>
          ) : verifications.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                <FileVideo className="w-8 h-8 text-gray-500" />
              </div>
              <p className="text-gray-400 mb-1">No verifications yet</p>
              <p className="text-gray-500 text-sm">
                Upload a video or audio to verify its authenticity
              </p>
              <button
                onClick={onVerify}
                className="mt-4 text-apple-blue text-sm font-medium hover:underline"
              >
                Verify content now
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {verifications.map((verification) => (
                <div
                  key={verification.id}
                  className={`p-4 rounded-xl border ${
                    verification.authentic
                      ? 'bg-apple-green/10 border-apple-green/20'
                      : 'bg-apple-red/10 border-apple-red/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        verification.authentic ? 'bg-apple-green/20' : 'bg-apple-red/20'
                      }`}
                    >
                      {verification.authentic ? (
                        <CheckCircle className="w-5 h-5 text-apple-green" />
                      ) : (
                        <XCircle className="w-5 h-5 text-apple-red" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`font-medium ${
                          verification.authentic ? 'text-apple-green' : 'text-apple-red'
                        }`}
                      >
                        {verification.authentic ? 'Authentic' : 'Potential Deepfake'}
                      </p>
                      <p className="text-gray-400 text-sm">
                        {Math.round(verification.confidence * 100)}% confidence
                      </p>
                      <p className="text-gray-500 text-xs mt-1">
                        {formatDate(verification.verified_at)} at {formatTime(verification.verified_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

const FeatureBar = ({ icon: Icon, label, value, count }) => {
  const percent = Math.round(value * 100);

  return (
    <div className="p-3 rounded-xl bg-white/5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-300">{label}</span>
        </div>
        <span className="text-sm text-gray-400">{count} samples</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-apple-blue to-apple-indigo rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(percent, 3)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
};

export default Dashboard;
