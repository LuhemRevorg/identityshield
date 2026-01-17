import { motion } from 'framer-motion';
import { Mic, Camera, Activity, Calendar } from 'lucide-react';

const ProfileStrength = ({ profile }) => {
  if (!profile) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-32 rounded-lg bg-white/5 shimmer" />
        <div className="flex justify-center">
          <div className="w-32 h-32 rounded-full bg-white/5 shimmer" />
        </div>
        <div className="space-y-3">
          <div className="h-12 rounded-xl bg-white/5 shimmer" />
          <div className="h-12 rounded-xl bg-white/5 shimmer" />
          <div className="h-12 rounded-xl bg-white/5 shimmer" />
        </div>
      </div>
    );
  }

  const strengthPercent = Math.round(profile.strength_score * 100);
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (profile.strength_score * circumference);

  const getStrengthColor = (score) => {
    if (score >= 0.7) return '#34C759'; // Apple green
    if (score >= 0.4) return '#FF9500'; // Apple orange
    return '#FF3B30'; // Apple red
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
      <div className="flex justify-center mb-8">
        <div className="relative">
          <svg className="progress-ring w-32 h-32">
            {/* Background circle */}
            <circle
              className="progress-ring-bg"
              strokeWidth="8"
              stroke="rgba(255,255,255,0.1)"
              fill="transparent"
              r="45"
              cx="64"
              cy="64"
            />
            {/* Progress circle */}
            <motion.circle
              className="progress-ring-fill"
              strokeWidth="8"
              stroke={getStrengthColor(profile.strength_score)}
              fill="transparent"
              r="45"
              cx="64"
              cy="64"
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1, ease: 'easeOut' }}
              style={{
                strokeDasharray: circumference,
                filter: `drop-shadow(0 0 8px ${getStrengthColor(profile.strength_score)}40)`,
              }}
            />
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-white tracking-tight">
              {strengthPercent}%
            </span>
            <span
              className="text-sm font-medium"
              style={{ color: getStrengthColor(profile.strength_score) }}
            >
              {getStrengthLabel(profile.strength_score)}
            </span>
          </div>
        </div>
      </div>

      {/* Feature coverage */}
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
        <div className="mt-6 pt-4 border-t border-white/10 flex items-center gap-2 text-gray-500 text-sm">
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
    <div className="p-3 rounded-xl bg-white/5 border border-white/5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-apple-blue/20 flex items-center justify-center">
            <Icon className="w-4 h-4 text-apple-blue" />
          </div>
          <span className="text-sm font-medium text-white">{label}</span>
        </div>
        <span className="text-sm text-gray-400">
          {count !== undefined ? `${count}` : `${percent}%`}
        </span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-apple-blue to-apple-indigo rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(percent, 5)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
};

export default ProfileStrength;
