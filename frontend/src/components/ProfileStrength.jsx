import { motion } from 'framer-motion';
import { Mic, Camera, Activity, Calendar } from 'lucide-react';

const ProfileStrength = ({ profile }) => {
  if (!profile) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-700 rounded w-1/3 mb-4" />
        <div className="h-32 bg-gray-700 rounded-full w-32 mx-auto mb-4" />
        <div className="space-y-2">
          <div className="h-4 bg-gray-700 rounded" />
          <div className="h-4 bg-gray-700 rounded w-2/3" />
        </div>
      </div>
    );
  }

  const strengthPercent = Math.round(profile.strength_score * 100);
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (profile.strength_score * circumference);

  const getStrengthColor = (score) => {
    if (score >= 0.7) return '#22c55e'; // Green
    if (score >= 0.4) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
  };

  const getStrengthLabel = (score) => {
    if (score >= 0.7) return 'Strong';
    if (score >= 0.4) return 'Moderate';
    return 'Weak';
  };

  return (
    <div>
      <h3 className="text-xl font-semibold text-white mb-6">Profile Strength</h3>

      {/* Circular progress */}
      <div className="flex justify-center mb-6">
        <div className="relative">
          <svg className="progress-ring w-32 h-32">
            {/* Background circle */}
            <circle
              className="text-gray-700"
              strokeWidth="8"
              stroke="currentColor"
              fill="transparent"
              r="45"
              cx="64"
              cy="64"
            />
            {/* Progress circle */}
            <motion.circle
              className="progress-ring-circle"
              strokeWidth="8"
              stroke={getStrengthColor(profile.strength_score)}
              fill="transparent"
              r="45"
              cx="64"
              cy="64"
              strokeLinecap="round"
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1, ease: 'easeOut' }}
              style={{
                strokeDasharray: circumference,
              }}
            />
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-white">{strengthPercent}%</span>
            <span
              className="text-sm font-medium"
              style={{ color: getStrengthColor(profile.strength_score) }}
            >
              {getStrengthLabel(profile.strength_score)}
            </span>
          </div>
        </div>
      </div>

      {/* Feature coverage bars */}
      <div className="space-y-4">
        <FeatureBar
          icon={Mic}
          label="Voice Samples"
          value={profile.feature_coverage?.voice || 0}
          count={profile.total_voice_samples}
        />
        <FeatureBar
          icon={Camera}
          label="Face Samples"
          value={profile.feature_coverage?.face || 0}
          count={profile.total_face_samples}
        />
        <FeatureBar
          icon={Activity}
          label="Sessions"
          value={profile.feature_coverage?.sessions || 0}
          count={profile.sessions_count}
        />
      </div>

      {/* Last updated */}
      {profile.last_updated && (
        <div className="mt-6 pt-4 border-t border-gray-700 flex items-center gap-2 text-gray-400 text-sm">
          <Calendar className="w-4 h-4" />
          Last updated: {new Date(profile.last_updated).toLocaleDateString()}
        </div>
      )}
    </div>
  );
};

const FeatureBar = ({ icon: Icon, label, value, count }) => {
  const percent = Math.round(value * 100);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-300">{label}</span>
        </div>
        <span className="text-sm text-gray-400">
          {count !== undefined ? `${count} samples` : `${percent}%`}
        </span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-primary-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
};

export default ProfileStrength;
