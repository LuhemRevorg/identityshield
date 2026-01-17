import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Send,
  X,
  Loader2,
  Clock,
  CheckCircle,
} from 'lucide-react';
import useMediaStream from '../hooks/useMediaStream';
import ConversationUI from './ConversationUI';
import { startEnrollment, uploadChunk, completeEnrollment, sendMessage } from '../services/api';

const VideoChat = ({ onComplete, onCancel }) => {
  // Session state
  const [sessionId, setSessionId] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // Conversation state
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [shouldEnd, setShouldEnd] = useState(false);

  // Timer state
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef(null);

  // Chunk counter
  const [chunksProcessed, setChunksProcessed] = useState(0);

  // Handle video chunk ready
  const handleChunkReady = useCallback(
    async (base64Video) => {
      if (!sessionId) return;

      try {
        const result = await uploadChunk(sessionId, base64Video);
        if (result.success) {
          setChunksProcessed((prev) => prev + 1);
        }
      } catch (err) {
        console.error('Error uploading chunk:', err);
      }
    },
    [sessionId]
  );

  // Media stream hook
  const {
    videoRef,
    isRecording,
    error: mediaError,
    permissionGranted,
    requestPermissions,
    startRecording,
    stopRecording,
    stopStream,
  } = useMediaStream(handleChunkReady);

  // Start enrollment session
  const handleStart = async () => {
    setIsStarting(true);
    try {
      // Request camera permissions first
      const granted = await requestPermissions();
      if (!granted) {
        setIsStarting(false);
        return;
      }

      // Start enrollment session
      const data = await startEnrollment();
      setSessionId(data.session_id);
      setUserId(data.user_id);

      // Add opening message from AI
      setMessages([{ role: 'assistant', content: data.message }]);

      // Start recording
      startRecording();

      // Start timer
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error starting enrollment:', err);
      alert('Failed to start enrollment. Please try again.');
    } finally {
      setIsStarting(false);
    }
  };

  // Send message to AI
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || !sessionId || isTyping) return;

    const userMessage = inputText.trim();
    setInputText('');

    // Add user message
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsTyping(true);

    try {
      const response = await sendMessage(sessionId, userMessage, elapsedTime);

      // Add AI response
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: response.response },
      ]);

      if (response.should_end) {
        setShouldEnd(true);
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "I'm having trouble responding. Let's continue our chat!",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // Complete enrollment
  const handleComplete = async () => {
    setIsCompleting(true);
    stopRecording();

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    try {
      await completeEnrollment(sessionId);
      stopStream();
      onComplete(userId);
    } catch (err) {
      console.error('Error completing enrollment:', err);
      alert('Failed to complete enrollment. Please try again.');
      setIsCompleting(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    stopRecording();
    stopStream();
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    onCancel();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Pre-enrollment view (permissions request)
  if (!sessionId) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card bg-gray-800/50 border border-gray-700 text-center">
          <Video className="w-16 h-16 text-primary-400 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-white mb-4">
            Let's Create Your Identity Profile
          </h2>
          <p className="text-gray-400 mb-6">
            You'll have a short video conversation with our AI assistant. During the
            chat, we'll capture your unique voice, facial expressions, and mannerisms
            to build your identity fingerprint.
          </p>

          <div className="bg-gray-900/50 rounded-lg p-4 mb-6 text-left">
            <h3 className="text-white font-semibold mb-2">What we'll need:</h3>
            <ul className="text-gray-400 text-sm space-y-2">
              <li className="flex items-center gap-2">
                <Video className="w-4 h-4 text-primary-400" />
                Camera access for facial analysis
              </li>
              <li className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-primary-400" />
                Microphone access for voice analysis
              </li>
              <li className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary-400" />
                About 5 minutes of your time
              </li>
            </ul>
          </div>

          {mediaError && (
            <div className="bg-red-900/50 text-red-300 p-3 rounded-lg mb-4">
              {mediaError}
            </div>
          )}

          <div className="flex gap-4 justify-center">
            <button onClick={onCancel} className="btn-secondary">
              Cancel
            </button>
            <button
              onClick={handleStart}
              disabled={isStarting}
              className="btn-primary flex items-center gap-2"
            >
              {isStarting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Video className="w-5 h-5" />
                  Start Conversation
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active enrollment view
  return (
    <div className="max-w-6xl mx-auto">
      {/* Processing overlay */}
      {isCompleting && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="text-center">
            <Loader2 className="w-16 h-16 text-primary-400 animate-spin mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              Building Your Identity Profile
            </h3>
            <p className="text-gray-400">Processing your voice and facial data...</p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Video feed */}
        <div className="space-y-4">
          <div className="video-container">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Recording indicator */}
            {isRecording && (
              <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full">
                <span className="w-3 h-3 bg-red-500 rounded-full recording-indicator" />
                <span className="text-white text-sm">Recording</span>
              </div>
            )}

            {/* Timer */}
            <div className="absolute top-4 right-4 bg-black/50 px-3 py-1.5 rounded-full">
              <span className="text-white text-sm font-mono">
                {formatTime(elapsedTime)}
              </span>
            </div>

            {/* Chunks processed */}
            <div className="absolute bottom-4 left-4 bg-black/50 px-3 py-1.5 rounded-full">
              <span className="text-white text-sm">
                {chunksProcessed} chunks processed
              </span>
            </div>
          </div>

          {/* End conversation button */}
          {(shouldEnd || elapsedTime >= 60) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <button
                onClick={handleComplete}
                disabled={isCompleting}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                Complete Enrollment
              </button>
            </motion.div>
          )}

          <button
            onClick={handleCancel}
            className="w-full text-gray-400 hover:text-white text-sm flex items-center justify-center gap-1"
          >
            <X className="w-4 h-4" />
            Cancel enrollment
          </button>
        </div>

        {/* Conversation panel */}
        <div className="card bg-gray-800/50 border border-gray-700 flex flex-col h-[500px]">
          <div className="flex-1 overflow-hidden">
            <ConversationUI messages={messages} isTyping={isTyping} />
          </div>

          {/* Input form */}
          <form onSubmit={handleSendMessage} className="border-t border-gray-700 pt-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type your response..."
                className="input bg-gray-900 border-gray-700 text-white placeholder-gray-500"
                disabled={isTyping || isCompleting}
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isTyping || isCompleting}
                className="btn-primary px-4"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default VideoChat;
