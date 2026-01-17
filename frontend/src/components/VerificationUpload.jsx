import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion } from 'framer-motion';
import {
  Upload,
  FileVideo,
  FileAudio,
  X,
  Loader2,
  ArrowLeft,
  AlertCircle,
  UploadCloud,
  Sparkles,
} from 'lucide-react';
import { verifyContent } from '../services/api';

const VerificationUpload = ({ userId, onComplete, onCancel }) => {
  const [file, setFile] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);

  // Handle file drop
  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.webm', '.mov', '.avi'],
      'audio/*': ['.mp3', '.wav', '.m4a', '.ogg'],
    },
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024, // 100MB
  });

  // Handle verification
  const handleVerify = async () => {
    if (!file) return;

    setIsVerifying(true);
    setProgress('Uploading file...');

    try {
      setProgress('Analyzing voice patterns...');
      await new Promise((r) => setTimeout(r, 500));

      setProgress('Analyzing facial features...');
      await new Promise((r) => setTimeout(r, 500));

      setProgress('Checking lip-sync...');
      const result = await verifyContent(userId, file);

      onComplete(result);
    } catch (err) {
      console.error('Verification error:', err);
      setError(
        err.response?.data?.detail ||
          'Verification failed. Please try again with a different file.'
      );
    } finally {
      setIsVerifying(false);
      setProgress(null);
    }
  };

  // Remove selected file
  const handleRemoveFile = () => {
    setFile(null);
    setError(null);
  };

  // Get file icon
  const FileIcon = file?.type?.startsWith('video') ? FileVideo : FileAudio;

  // Format file size
  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back button */}
      <button
        onClick={onCancel}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
        Back to Dashboard
      </button>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-apple-blue/20 to-apple-indigo/20 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-apple-blue" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Verify Content</h2>
          <p className="text-gray-400">
            Upload a video or audio file to check if it's authentic or synthetic.
          </p>
        </div>

        {/* Processing overlay */}
        {isVerifying && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center z-50"
          >
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-6 relative">
                <div className="absolute inset-0 rounded-full border-4 border-white/10" />
                <div className="absolute inset-0 rounded-full border-4 border-apple-blue border-t-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Upload className="w-10 h-10 text-apple-blue" />
                </div>
              </div>
              <h3 className="text-2xl font-semibold text-white mb-2">
                Analyzing Content
              </h3>
              <p className="text-gray-400">{progress}</p>
            </div>
          </motion.div>
        )}

        {/* Dropzone */}
        {!file ? (
          <div
            {...getRootProps()}
            className={`drop-zone ${isDragActive ? 'active' : ''}`}
          >
            <input {...getInputProps()} />
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 flex items-center justify-center">
              <UploadCloud
                className={`w-8 h-8 ${isDragActive ? 'text-apple-blue' : 'text-gray-500'}`}
              />
            </div>
            <p className="text-white font-semibold mb-1">
              {isDragActive ? 'Drop the file here' : 'Drag & drop a file here'}
            </p>
            <p className="text-gray-500 text-sm mb-4">
              or click to browse
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {['MP4', 'WebM', 'MOV', 'MP3', 'WAV'].map((format) => (
                <span
                  key={format}
                  className="px-2 py-1 text-xs text-gray-500 bg-white/5 rounded-md"
                >
                  {format}
                </span>
              ))}
            </div>
            <p className="text-gray-600 text-xs mt-3">Maximum file size: 100MB</p>
          </div>
        ) : (
          /* Selected file preview */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl bg-white/5 border border-white/10 p-5"
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-apple-blue/20 to-apple-indigo/20 flex items-center justify-center flex-shrink-0">
                <FileIcon className="w-7 h-7 text-apple-blue" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{file.name}</p>
                <p className="text-gray-500 text-sm">
                  {formatSize(file.size)} • {file.type || 'Unknown type'}
                </p>
              </div>
              <button
                onClick={handleRemoveFile}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Video preview */}
            {file.type?.startsWith('video') && (
              <div className="mt-4 rounded-xl overflow-hidden bg-black">
                <video
                  src={URL.createObjectURL(file)}
                  controls
                  className="w-full max-h-64 object-contain"
                />
              </div>
            )}

            {/* Audio preview */}
            {file.type?.startsWith('audio') && (
              <div className="mt-4 p-4 rounded-xl bg-black/50">
                <audio
                  src={URL.createObjectURL(file)}
                  controls
                  className="w-full"
                />
              </div>
            )}
          </motion.div>
        )}

        {/* Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 rounded-xl bg-apple-red/10 border border-apple-red/30 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-apple-red flex-shrink-0 mt-0.5" />
            <p className="text-apple-red text-sm">{error}</p>
          </motion.div>
        )}

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button onClick={onCancel} className="flex-1 btn-secondary-apple">
            Cancel
          </button>
          <button
            onClick={handleVerify}
            disabled={!file || isVerifying}
            className="flex-1 btn-apple"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Verify Content
              </>
            )}
          </button>
        </div>

        {/* Info box */}
        <div className="mt-8 p-4 rounded-xl bg-white/5 border border-white/5">
          <p className="text-sm font-medium text-white mb-3">How it works</p>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-start gap-2">
              <span className="text-apple-blue">1.</span>
              Extract voice and face features from your uploaded content
            </li>
            <li className="flex items-start gap-2">
              <span className="text-apple-blue">2.</span>
              Compare against your enrolled identity profile
            </li>
            <li className="flex items-start gap-2">
              <span className="text-apple-blue">3.</span>
              Analyze voice patterns, facial features, and lip-sync timing
            </li>
            <li className="flex items-start gap-2">
              <span className="text-apple-blue">4.</span>
              Get confidence scores and detected anomalies
            </li>
          </ul>
        </div>
      </motion.div>
    </div>
  );
};

export default VerificationUpload;
