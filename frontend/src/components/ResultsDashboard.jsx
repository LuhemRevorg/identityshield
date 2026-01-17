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
} from 'lucide-react';

const ResultsDashboard = ({ result, onBack }) => {
  if (!result) {
    return (
      <div className="text-center text-gray-400">
        <p>No verification results available.</p>
        <button onClick={onBack} className="btn-primary mt-4">
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
        className="flex items-center gap-2 text-gray-400 hover:text-white mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      {/* Main verdict card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`card border-2 mb-8 ${
          authentic
            ? 'bg-green-900/20 border-green-500/50'
            : 'bg-red-900/20 border-red-500/50'
        }`}
      >
        <div className="text-center">
          {authentic ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
            >
              <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
            </motion.div>
          ) : (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
            >
              <XCircle className="w-20 h-20 text-red-500 mx-auto mb-4" />
            </motion.div>
          )}

          <h2 className="text-3xl font-bold text-white mb-2">
            {authentic ? 'Content Appears Authentic' : 'Potential Deepfake Detected'}
          </h2>

          <p className="text-gray-400 mb-4">
            {authentic
              ? 'The analyzed content matches your identity profile.'
              : 'The analyzed content shows signs of manipulation or synthesis.'}
          </p>

          <div className="inline-flex items-center gap-2 bg-gray-800/50 px-4 py-2 rounded-full">
            <span className="text-gray-400">Confidence:</span>
            <span
              className={`text-2xl font-bold ${
                authentic ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {confidencePercent}%
            </span>
          </div>
        </div>
      </motion.div>

      {/* Feature breakdown */}
      <div className="card bg-gray-800/50 border border-gray-700 mb-8">
        <h3 className="text-xl font-semibold text-white mb-6">Analysis Breakdown</h3>

        <div className="space-y-6">
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
            description="Audio-visual synchronization"
          />
          <FeatureScore
            icon={MessageSquare}
            label="Speech Patterns"
            score={breakdown.speech_patterns}
            description="Speaking style and rhythm"
          />
        </div>
      </div>

      {/* Anomalies */}
      {anomalies && anomalies.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-yellow-900/20 border border-yellow-500/50 mb-8"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-500 flex-shrink-0" />
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">
                Detected Anomalies
              </h3>
              <ul className="space-y-2">
                {anomalies.map((anomaly, index) => (
                  <li key={index} className="text-yellow-200 text-sm">
                    • {anomaly}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      )}

      {/* Analysis details */}
      {analysis_details && (
        <div className="card bg-gray-800/50 border border-gray-700 mb-8">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-gray-300 mb-2">
                Analysis Details
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {analysis_details.voice_samples_compared !== undefined && (
                  <div>
                    <span className="text-gray-500">Voice samples analyzed:</span>
                    <span className="text-gray-300 ml-2">
                      {analysis_details.voice_samples_compared}
                    </span>
                  </div>
                )}
                {analysis_details.face_samples_compared !== undefined && (
                  <div>
                    <span className="text-gray-500">Face samples analyzed:</span>
                    <span className="text-gray-300 ml-2">
                      {analysis_details.face_samples_compared}
                    </span>
                  </div>
                )}
                {analysis_details.test_duration !== undefined && (
                  <div>
                    <span className="text-gray-500">Content duration:</span>
                    <span className="text-gray-300 ml-2">
                      {analysis_details.test_duration.toFixed(1)}s
                    </span>
                  </div>
                )}
                {analysis_details.profile_strength !== undefined && (
                  <div>
                    <span className="text-gray-500">Profile strength:</span>
                    <span className="text-gray-300 ml-2">
                      {Math.round(analysis_details.profile_strength * 100)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <button onClick={onBack} className="btn-secondary flex-1">
          Back to Dashboard
        </button>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary flex-1"
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
    if (score >= 0.7) return 'bg-green-500';
    if (score >= 0.4) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getTextColor = (score) => {
    if (score >= 0.7) return 'text-green-400';
    if (score >= 0.4) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
            <Icon className="w-5 h-5 text-gray-400" />
          </div>
          <div>
            <span className="text-white font-medium">{label}</span>
            <p className="text-gray-500 text-xs">{description}</p>
          </div>
        </div>
        <span className={`text-xl font-bold ${getTextColor(score)}`}>
          {percent}%
        </span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${getColor(score)} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
};

export default ResultsDashboard;
