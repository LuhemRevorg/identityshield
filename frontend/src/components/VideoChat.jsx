import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video,
  Mic,
  Send,
  ArrowLeft,
  Loader2,
  Clock,
  CheckCircle,
  Circle,
  MessageCircle,
  Briefcase,
  Gamepad2,
  Heart,
  Lightbulb,
  Music,
  Plane,
  Utensils,
  Pencil,
  Volume2,
  VolumeX,
} from 'lucide-react';
import useMediaStream from '../hooks/useMediaStream';
import ConversationUI from './ConversationUI';
import { startEnrollment, uploadChunk, completeEnrollment, sendMessage, transcribeAudio } from '../services/api';

// Predefined conversation topics
const TOPICS = [
  { id: 'general', label: 'General Chat', icon: MessageCircle, description: 'Casual conversation about anything' },
  { id: 'work', label: 'Work & Career', icon: Briefcase, description: 'Discuss your profession and goals' },
  { id: 'hobbies', label: 'Hobbies & Games', icon: Gamepad2, description: 'Talk about your favorite pastimes' },
  { id: 'travel', label: 'Travel & Adventure', icon: Plane, description: 'Share travel stories and dreams' },
  { id: 'food', label: 'Food & Cooking', icon: Utensils, description: 'Discuss culinary experiences' },
  { id: 'music', label: 'Music & Arts', icon: Music, description: 'Talk about creative interests' },
  { id: 'ideas', label: 'Ideas & Philosophy', icon: Lightbulb, description: 'Explore deep thoughts' },
  { id: 'relationships', label: 'Life & Relationships', icon: Heart, description: 'Share personal stories' },
];

const VideoChat = ({ userId: propUserId, onComplete, onCancel }) => {
  // Step state: 'topic' -> 'permissions' -> 'conversation'
  const [step, setStep] = useState('topic');

  // Topic state
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [customTopic, setCustomTopic] = useState('');
  const [useCustomTopic, setUseCustomTopic] = useState(false);

  // Session state
  const [sessionId, setSessionId] = useState(null);
  const [userId, setUserId] = useState(propUserId);
  const [isStarting, setIsStarting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // Conversation state
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [shouldEnd, setShouldEnd] = useState(false);

  // Audio state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const audioRef = useRef(null);

  // Mic recording state (for server-side transcription via Groq Whisper)
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const micRecorderRef = useRef(null);
  const micStreamRef = useRef(null);
  const audioChunksRef = useRef([]);

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
    stream,
    videoRef,
    isRecording,
    error: mediaError,
    permissionGranted,
    requestPermissions,
    startRecording,
    stopRecording,
    stopStream,
  } = useMediaStream(handleChunkReady);

  // Attach stream to video element when video mounts
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [sessionId, stream, videoRef]);

  // Play audio response
  const playAudio = useCallback(async (audioBase64) => {
    if (!audioEnabled || !audioBase64) return;

    try {
      setIsSpeaking(true);
      const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
      };

      audio.onerror = () => {
        setIsSpeaking(false);
        console.error('Audio playback error');
      };

      await audio.play();
    } catch (err) {
      console.error('Error playing audio:', err);
      setIsSpeaking(false);
    }
  }, [audioEnabled]);

  // Stop audio
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
  };

  // Start mic recording for server-side transcription
  const startMicRecording = async () => {
    if (isRecordingMic || isSpeaking || isTyping || isTranscribing) return;

    try {
      stopAudio(); // Stop any playing audio

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      audioChunksRef.current = [];

      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      micRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        // Stop the stream
        if (micStreamRef.current) {
          micStreamRef.current.getTracks().forEach(track => track.stop());
          micStreamRef.current = null;
        }

        // Process the recorded audio
        if (audioChunksRef.current.length > 0) {
          setIsTranscribing(true);
          try {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

            // Convert to base64
            const reader = new FileReader();
            reader.onloadend = async () => {
              const base64 = reader.result.split(',')[1];

              try {
                // Send to backend for transcription
                const result = await transcribeAudio(base64);

                if (result.success && result.text) {
                  // Set the transcribed text and auto-send
                  setInputText(result.text);

                  // Auto-send after a brief delay
                  setTimeout(() => {
                    const form = document.getElementById('chat-form');
                    if (form) form.requestSubmit();
                  }, 100);
                }
              } catch (err) {
                console.error('Transcription error:', err);
              } finally {
                setIsTranscribing(false);
              }
            };
            reader.readAsDataURL(audioBlob);
          } catch (err) {
            console.error('Error processing audio:', err);
            setIsTranscribing(false);
          }
        }
      };

      recorder.start();
      setIsRecordingMic(true);
    } catch (err) {
      console.error('Error starting mic recording:', err);
    }
  };

  // Stop mic recording
  const stopMicRecording = () => {
    if (micRecorderRef.current && isRecordingMic) {
      micRecorderRef.current.stop();
      setIsRecordingMic(false);
    }
  };

  // Cleanup mic recording on unmount
  useEffect(() => {
    return () => {
      if (micRecorderRef.current) {
        micRecorderRef.current.stop();
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Get the final topic string
  const getTopicString = () => {
    if (useCustomTopic && customTopic.trim()) {
      return customTopic.trim();
    }
    if (selectedTopic) {
      const topic = TOPICS.find(t => t.id === selectedTopic);
      return topic ? topic.label : 'General Chat';
    }
    return 'General Chat';
  };

  // Handle topic selection and move to permissions
  const handleTopicContinue = () => {
    if (!selectedTopic && !customTopic.trim()) {
      setSelectedTopic('general'); // Default to general
    }
    setStep('permissions');
  };

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

      // Start enrollment session with topic
      const topic = getTopicString();
      const data = await startEnrollment(topic);
      setSessionId(data.session_id);
      setUserId(data.user_id);

      // Add opening message from AI
      setMessages([{ role: 'assistant', content: data.message }]);

      // Play audio if available
      if (data.audio_base64) {
        playAudio(data.audio_base64);
      }

      // Start recording
      startRecording();

      // Start timer
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);

      setStep('conversation');
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

    const userMessage = inputText.trim();
    if (!userMessage || !sessionId || isTyping) return;

    setInputText('');

    // Stop any playing audio
    stopAudio();

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

      // Play audio response
      if (response.audio_base64) {
        playAudio(response.audio_base64);
      }

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
    stopAudio();
    stopMicRecording();

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
    stopAudio();
    stopMicRecording();
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
      stopAudio();
    };
  }, []);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage (target: 5 minutes = 300 seconds)
  const progressPercent = Math.min((elapsedTime / 300) * 100, 100);

  // Step 1: Topic Selection
  if (step === 'topic') {
    return (
      <div className="max-w-2xl mx-auto pt-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-apple-blue/20 to-apple-indigo/20 flex items-center justify-center">
              <MessageCircle className="w-8 h-8 text-apple-blue" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Choose a Conversation Topic
            </h2>
            <p className="text-gray-400">
              Select what you'd like to chat about, or enter your own topic
            </p>
          </div>

          {/* Topic Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {TOPICS.map((topic) => (
              <button
                key={topic.id}
                onClick={() => {
                  setSelectedTopic(topic.id);
                  setUseCustomTopic(false);
                }}
                className={`p-4 rounded-xl text-left transition-all ${
                  selectedTopic === topic.id && !useCustomTopic
                    ? 'bg-apple-blue/20 border-2 border-apple-blue'
                    : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <topic.icon className={`w-5 h-5 ${
                    selectedTopic === topic.id && !useCustomTopic
                      ? 'text-apple-blue'
                      : 'text-gray-400'
                  }`} />
                  <span className={`font-medium ${
                    selectedTopic === topic.id && !useCustomTopic
                      ? 'text-white'
                      : 'text-gray-300'
                  }`}>
                    {topic.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{topic.description}</p>
              </button>
            ))}
          </div>

          {/* Custom Topic */}
          <div className="mb-8">
            <button
              onClick={() => setUseCustomTopic(!useCustomTopic)}
              className={`w-full p-4 rounded-xl text-left transition-all flex items-center gap-3 ${
                useCustomTopic
                  ? 'bg-apple-purple/20 border-2 border-apple-purple'
                  : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
              }`}
            >
              <Pencil className={`w-5 h-5 ${useCustomTopic ? 'text-apple-purple' : 'text-gray-400'}`} />
              <span className={`font-medium ${useCustomTopic ? 'text-white' : 'text-gray-300'}`}>
                Enter Custom Topic
              </span>
            </button>

            <AnimatePresence>
              {useCustomTopic && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3"
                >
                  <input
                    type="text"
                    value={customTopic}
                    onChange={(e) => setCustomTopic(e.target.value)}
                    placeholder="e.g., Space exploration, AI ethics, Vintage cars..."
                    className="input-apple"
                    autoFocus
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 btn-secondary-apple">
              Cancel
            </button>
            <button
              onClick={handleTopicContinue}
              disabled={useCustomTopic && !customTopic.trim()}
              className="flex-1 btn-apple"
            >
              Continue
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Step 2: Permissions & Start
  if (step === 'permissions') {
    return (
      <div className="max-w-xl mx-auto pt-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 text-center"
        >
          {/* Icon */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-apple-blue/20 to-apple-indigo/20 flex items-center justify-center">
            <Video className="w-10 h-10 text-apple-blue" />
          </div>

          <h2 className="text-2xl font-bold text-white mb-3">
            Ready to Start
          </h2>

          {/* Selected topic badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-apple-blue/20 text-apple-blue text-sm mb-6">
            <MessageCircle className="w-4 h-4" />
            Topic: {getTopicString()}
          </div>

          <p className="text-gray-400 mb-8 leading-relaxed">
            We'll capture your unique voice, facial expressions, and mannerisms
            during the conversation to build your identity fingerprint.
          </p>

          {/* Requirements */}
          <div className="space-y-3 mb-8">
            {[
              { icon: Video, text: 'Camera access for facial analysis' },
              { icon: Mic, text: 'Microphone access for voice analysis' },
              { icon: Volume2, text: 'AI will speak back to you' },
              { icon: Clock, text: 'About 5 minutes of your time' },
            ].map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/5"
              >
                <div className="w-8 h-8 rounded-lg bg-apple-blue/20 flex items-center justify-center">
                  <item.icon className="w-4 h-4 text-apple-blue" />
                </div>
                <span className="text-gray-300 text-sm">{item.text}</span>
              </div>
            ))}
          </div>

          {/* Error message */}
          {mediaError && (
            <div className="mb-6 p-4 rounded-xl bg-apple-red/10 border border-apple-red/30">
              <p className="text-apple-red text-sm">{mediaError}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={() => setStep('topic')} className="flex-1 btn-secondary-apple">
              Back
            </button>
            <button
              onClick={handleStart}
              disabled={isStarting}
              className="flex-1 btn-apple"
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
        </motion.div>
      </div>
    );
  }

  // Step 3: Active Conversation
  return (
    <div className="max-w-6xl mx-auto">
      {/* Processing overlay */}
      {isCompleting && (
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
                <CheckCircle className="w-10 h-10 text-apple-blue" />
              </div>
            </div>
            <h3 className="text-2xl font-semibold text-white mb-2">
              Building Your Profile
            </h3>
            <p className="text-gray-400">Processing your voice and facial data...</p>
          </div>
        </motion.div>
      )}

      {/* Back button */}
      <button
        onClick={handleCancel}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Cancel enrollment</span>
      </button>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Video Panel */}
        <div className="space-y-4">
          {/* Video Container */}
          <div className="video-container relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />

            {/* Overlay Controls */}
            <div className="absolute inset-0 pointer-events-none z-10">
              {/* Top bar */}
              <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
                {/* Recording indicator */}
                {isRecording && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm">
                    <span className="w-2.5 h-2.5 bg-apple-red rounded-full recording-indicator" />
                    <span className="text-white text-sm font-medium">Recording</span>
                  </div>
                )}

                {/* Timer */}
                <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm ml-auto">
                  <span className="text-white text-sm font-mono">{formatTime(elapsedTime)}</span>
                </div>
              </div>

              {/* Speaking indicator */}
              {isSpeaking && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-apple-blue/80 backdrop-blur-sm">
                    <Volume2 className="w-5 h-5 text-white animate-pulse" />
                    <span className="text-white text-sm font-medium">AI Speaking...</span>
                  </div>
                </div>
              )}

              {/* Bottom bar */}
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="flex items-center gap-3">
                  {/* Progress bar */}
                  <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-apple-blue rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <span className="text-white/60 text-xs">{chunksProcessed} chunks</span>
                </div>
              </div>
            </div>
          </div>

          {/* Audio toggle */}
          <button
            onClick={() => {
              if (audioEnabled) stopAudio();
              setAudioEnabled(!audioEnabled);
            }}
            className={`w-full p-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
              audioEnabled
                ? 'bg-apple-blue/20 text-apple-blue'
                : 'bg-white/5 text-gray-400'
            }`}
          >
            {audioEnabled ? (
              <>
                <Volume2 className="w-5 h-5" />
                AI Voice Enabled
              </>
            ) : (
              <>
                <VolumeX className="w-5 h-5" />
                AI Voice Disabled
              </>
            )}
          </button>

          {/* Complete button */}
          {(shouldEnd || elapsedTime >= 60) && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={handleComplete}
              disabled={isCompleting}
              className="w-full btn-success py-4"
            >
              <CheckCircle className="w-5 h-5" />
              Complete Enrollment
            </motion.button>
          )}
        </div>

        {/* Chat Panel */}
        <div className="glass-card flex flex-col h-[500px] lg:h-[600px] lg:max-h-[calc(100vh-200px)]">
          {/* Header */}
          <div className="px-5 py-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-apple-blue to-apple-indigo flex items-center justify-center ${
                  isSpeaking ? 'animate-pulse' : ''
                }`}>
                  <span className="text-white font-semibold text-sm">AI</span>
                </div>
                <div>
                  <h3 className="text-white font-semibold">IdentityShield Assistant</h3>
                  <p className={`text-xs flex items-center gap-1 ${
                    isSpeaking ? 'text-apple-blue' : 'text-green-400'
                  }`}>
                    <Circle className="w-2 h-2 fill-current" />
                    {isSpeaking ? 'Speaking...' : 'Active'}
                  </p>
                </div>
              </div>
              <div className="px-3 py-1 rounded-full bg-white/5 text-xs text-gray-400">
                {getTopicString()}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ConversationUI messages={messages} isTyping={isTyping} />
          </div>

          {/* Input */}
          <form id="chat-form" onSubmit={handleSendMessage} className="p-4 border-t border-white/10">
            <div className="flex gap-2">
              {/* Mic button - hold to record */}
              <button
                type="button"
                onMouseDown={startMicRecording}
                onMouseUp={stopMicRecording}
                onMouseLeave={stopMicRecording}
                onTouchStart={startMicRecording}
                onTouchEnd={stopMicRecording}
                disabled={isTyping || isCompleting || isSpeaking || isTranscribing}
                className={`px-4 rounded-xl flex items-center justify-center transition-all select-none ${
                  isRecordingMic
                    ? 'bg-apple-red text-white animate-pulse'
                    : isTranscribing
                    ? 'bg-apple-orange/20 text-apple-orange'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                {isTranscribing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  isRecordingMic
                    ? 'Recording...'
                    : isTranscribing
                    ? 'Transcribing...'
                    : isSpeaking
                    ? 'AI is speaking...'
                    : isTyping
                    ? 'Waiting for response...'
                    : 'Hold mic to speak or type...'
                }
                className="input-apple flex-1"
                disabled={isTyping || isCompleting || isSpeaking || isRecordingMic || isTranscribing}
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isTyping || isCompleting || isSpeaking || isRecordingMic || isTranscribing}
                className="btn-apple px-4"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            {isRecordingMic ? (
              <p className="text-xs text-apple-red mt-2 text-center animate-pulse">
                Recording... Release to send
              </p>
            ) : isTranscribing ? (
              <p className="text-xs text-apple-orange mt-2 text-center animate-pulse">
                Transcribing your message...
              </p>
            ) : isSpeaking ? (
              <p className="text-xs text-apple-blue mt-2 text-center animate-pulse">
                AI is speaking...
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-2 text-center">
                Hold the mic button to speak
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default VideoChat;
