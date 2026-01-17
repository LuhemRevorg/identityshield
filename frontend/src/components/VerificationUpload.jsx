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
        className="flex items-center gap-2 text-gray-400 hover:text-white mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      <div className="card bg-gray-800/50 border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-2">Verify Content</h2>
        <p className="text-gray-400 mb-6">
          Upload a video or audio file to check if it's authentic or synthetic.
        </p>

        {/* Processing overlay */}
        {isVerifying && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="text-center">
              <div className="relative w-24 h-24 mx-auto mb-4">
                <Loader2 className="w-24 h-24 text-primary-400 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Upload className="w-8 h-8 text-primary-400" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Analyzing Content
              </h3>
              <p className="text-gray-400">{progress}</p>
            </div>
          </div>
        )}

        {/* Dropzone */}
        {!file ? (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-primary-500 bg-primary-500/10'
                : 'border-gray-600 hover:border-gray-500'
            }`}
          >
            <input {...getInputProps()} />
            <Upload
              className={`w-12 h-12 mx-auto mb-4 ${
                isDragActive ? 'text-primary-400' : 'text-gray-500'
              }`}
            />
            <p className="text-white font-medium mb-2">
              {isDragActive
                ? 'Drop the file here'
                : 'Drag & drop a video or audio file'}
            </p>
            <p className="text-gray-500 text-sm">
              or click to browse (max 100MB)
            </p>
            <p className="text-gray-600 text-xs mt-2">
              Supported: MP4, WebM, MOV, AVI, MP3, WAV, M4A
            </p>
          </div>
        ) : (
          /* Selected file preview */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gray-900/50 rounded-xl p-6"
          >
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-primary-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileIcon className="w-8 h-8 text-primary-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{file.name}</p>
                <p className="text-gray-500 text-sm">
                  {formatSize(file.size)} • {file.type || 'Unknown type'}
                </p>
              </div>
              <button
                onClick={handleRemoveFile}
                className="text-gray-500 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video preview for video files */}
            {file.type?.startsWith('video') && (
              <div className="mt-4 rounded-lg overflow-hidden bg-black">
                <video
                  src={URL.createObjectURL(file)}
                  controls
                  className="w-full max-h-64 object-contain"
                />
              </div>
            )}

            {/* Audio preview for audio files */}
            {file.type?.startsWith('audio') && (
              <div className="mt-4">
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 bg-red-900/50 text-red-300 p-4 rounded-lg flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p>{error}</p>
          </motion.div>
        )}

        {/* Actions */}
        <div className="mt-6 flex gap-4">
          <button onClick={onCancel} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={handleVerify}
            disabled={!file || isVerifying}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
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
        <div className="mt-6 bg-gray-900/50 rounded-lg p-4 text-sm text-gray-400">
          <p className="font-medium text-gray-300 mb-2">How it works:</p>
          <ul className="space-y-1">
            <li>• We extract voice and face features from your uploaded content</li>
            <li>• These are compared against your enrolled identity profile</li>
            <li>• We check voice patterns, facial features, and lip-sync timing</li>
            <li>• Results show confidence scores and any detected anomalies</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default VerificationUpload;
