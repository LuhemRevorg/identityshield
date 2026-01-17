import { motion } from 'framer-motion';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Mic,
  Camera,
  Activity,
  MessageSquare,
  ArrowLeft,
  Info,
  Shield,
  ShieldAlert,
} from 'lucide-react';

const ResultsDashboard = ({ result, onBack }) => {
  if (!result) {
    return (
      <div className="max-w-xl mx-auto text-center pt-20">
        <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-white/5 flex items-center justify-center">
          <Info className="w-10 h-10 text-gray-500" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-3">No Results Available</h2>
        <p className="text-gray-400 mb-8">Upload a file to verify its authenticity.</p>
        <button onClick={onBack} className="btn-apple">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const { authentic, confidence, breakdown, anomalies, analysis_details } = result;
  const confidencePercent = Math.round(confidence * 100);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Dashboard
      </button>

      {/* Main verdict card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`glass-card p-8 mb-6 text-center ${
          authentic ? 'glow-green' : 'glow-red'
        }`}
      >
        {authentic ? (
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', delay: 0.2, duration: 0.6 }}
            className="w-24 h-24 mx-auto mb-6 rounded-full bg-apple-green/20 flex items-center justify-center"
          >
            <Shield className="w-12 h-12 text-apple-green" />
          </motion.div>
        ) : (
          <motion.div
            initial={{ scale: 0, rotate: 180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', delay: 0.2, duration: 0.6 }}
            className="w-24 h-24 mx-auto mb-6 rounded-full bg-apple-red/20 flex items-center justify-center"
          >
            <ShieldAlert className="w-12 h-12 text-apple-red" />
          </motion.div>
        )}

        <h2 className="text-3xl font-bold text-white mb-3">
          {authentic ? 'Content Appears Authentic' : 'Potential Deepfake Detected'}
        </h2>

        <p className="text-gray-400 mb-6 max-w-md mx-auto">
          {authentic
            ? 'The analyzed content matches your identity profile with high confidence.'
            : 'The analyzed content shows signs of manipulation or synthetic generation.'}
        </p>

        {/* Confidence meter */}
        <div className="inline-flex flex-col items-center p-6 rounded-2xl bg-white/5">
          <span className="text-sm text-gray-400 mb-2">Confidence Score</span>
          <span
            className={`text-5xl font-bold tracking-tight ${
              authentic ? 'text-apple-green' : 'text-apple-red'
            }`}
          >
            {confidencePercent}%
          </span>
          <div className="w-48 h-2 mt-4 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                authentic ? 'bg-apple-green' : 'bg-apple-red'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${confidencePercent}%` }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
            />
          </div>
        </div>
      </motion.div>

      {/* Feature breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-6 mb-6"
      >
        <h3 className="text-lg font-semibold text-white mb-6">Analysis Breakdown</h3>

        <div className="grid sm:grid-cols-2 gap-4">
          <FeatureScore
            icon={Mic}
            label="Voice Match"
            score={breakdown.voice_match}
            description="Speaker embedding similarity"
          />
          <FeatureScore
            icon={Camera}
            label="Face Match"
            score={breakdown.face_match}
            description="Facial feature similarity"
          />
          <FeatureScore
            icon={Activity}
            label="Lip Sync"
            score={breakdown.lip_sync}
            description="Audio-visual sync"
          />
          <FeatureScore
            icon={MessageSquare}
            label="Speech Patterns"
            score={breakdown.speech_patterns}
            description="Speaking style"
          />
        </div>
      </motion.div>

      {/* Anomalies */}
      {anomalies && anomalies.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6 mb-6 border-apple-orange/30"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-apple-orange/20 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-apple-orange" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">
                Detected Anomalies
              </h3>
              <ul className="space-y-2">
                {anomalies.map((anomaly, index) => (
                  <li key={index} className="text-gray-300 text-sm flex items-start gap-2">
                    <span className="text-apple-orange">•</span>
                    {anomaly}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      )}

      {/* Analysis details */}
      {analysis_details && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card-light p-5 mb-6"
        >
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-gray-300 mb-3">
                Analysis Details
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {analysis_details.voice_samples_compared !== undefined && (
                  <div className="p-3 rounded-xl bg-white/5">
                    <span className="text-gray-500 block text-xs mb-1">Voice samples</span>
                    <span className="text-white font-medium">
                      {analysis_details.voice_samples_compared}
                    </span>
                  </div>
                )}
                {analysis_details.face_samples_compared !== undefined && (
                  <div className="p-3 rounded-xl bg-white/5">
                    <span className="text-gray-500 block text-xs mb-1">Face samples</span>
                    <span className="text-white font-medium">
                      {analysis_details.face_samples_compared}
                    </span>
                  </div>
                )}
                {analysis_details.test_duration !== undefined && (
                  <div className="p-3 rounded-xl bg-white/5">
                    <span className="text-gray-500 block text-xs mb-1">Duration</span>
                    <span className="text-white font-medium">
                      {analysis_details.test_duration.toFixed(1)}s
                    </span>
                  </div>
                )}
                {analysis_details.profile_strength !== undefined && (
                  <div className="p-3 rounded-xl bg-white/5">
                    <span className="text-gray-500 block text-xs mb-1">Profile strength</span>
                    <span className="text-white font-medium">
                      {Math.round(analysis_details.profile_strength * 100)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={onBack} className="flex-1 btn-secondary-apple">
          Back to Dashboard
        </button>
        <button
          onClick={() => window.location.reload()}
          className="flex-1 btn-apple"
        >
          Verify Another File
        </button>
      </div>
    </div>
  );
};

const FeatureScore = ({ icon: Icon, label, score, description }) => {
  const percent = Math.round(score * 100);

  const getColor = (score) => {
    if (score >= 0.7) return { bg: 'bg-apple-green', text: 'text-apple-green', glow: 'rgba(52, 199, 89, 0.3)' };
    if (score >= 0.4) return { bg: 'bg-apple-orange', text: 'text-apple-orange', glow: 'rgba(255, 149, 0, 0.3)' };
    return { bg: 'bg-apple-red', text: 'text-apple-red', glow: 'rgba(255, 59, 48, 0.3)' };
  };

  const colors = getColor(score);

  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
            <Icon className="w-4 h-4 text-gray-400" />
          </div>
          <div>
            <span className="text-white font-medium text-sm block">{label}</span>
            <span className="text-gray-500 text-xs">{description}</span>
          </div>
        </div>
        <span className={`text-xl font-bold ${colors.text}`}>
          {percent}%
        </span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${colors.bg} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ boxShadow: `0 0 10px ${colors.glow}` }}
        />
      </div>
    </div>
  );
};

export default ResultsDashboard;
