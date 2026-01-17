import { useState, useRef, useCallback, useEffect } from 'react';

const CHUNK_DURATION_MS = 10000; // 10 seconds

export const useMediaStream = (onChunkReady) => {
  const [stream, setStream] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const chunkIntervalRef = useRef(null);

  // Request camera and microphone permissions
  const requestPermissions = useCallback(async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      setStream(mediaStream);
      setPermissionGranted(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      return true;
    } catch (err) {
      console.error('Error accessing media devices:', err);
      setError(
        err.name === 'NotAllowedError'
          ? 'Camera/microphone access denied. Please grant permissions.'
          : 'Could not access camera/microphone. Please check your device.'
      );
      setPermissionGranted(false);
      return false;
    }
  }, []);

  // Start recording video chunks
  const startRecording = useCallback(() => {
    if (!stream) {
      console.error('No stream available');
      return;
    }

    try {
      // Determine supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 1000000, // 1 Mbps
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Collect chunks every CHUNK_DURATION_MS
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);

      // Set up interval to process and send chunks
      chunkIntervalRef.current = setInterval(() => {
        if (chunksRef.current.length > 0) {
          processAndSendChunk();
        }
      }, CHUNK_DURATION_MS);

    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to start recording');
    }
  }, [stream]);

  // Process accumulated chunks and send to callback
  const processAndSendChunk = useCallback(async () => {
    if (chunksRef.current.length === 0) return;

    const blob = new Blob(chunksRef.current, { type: 'video/webm' });
    chunksRef.current = []; // Clear chunks

    // Convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result;
      if (onChunkReady) {
        onChunkReady(base64);
      }
    };
    reader.readAsDataURL(blob);
  }, [onChunkReady]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    if (chunkIntervalRef.current) {
      clearInterval(chunkIntervalRef.current);
      chunkIntervalRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Process any remaining chunks
    if (chunksRef.current.length > 0) {
      await processAndSendChunk();
    }

    setIsRecording(false);
  }, [processAndSendChunk]);

  // Stop stream completely
  const stopStream = useCallback(() => {
    stopRecording();

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }

    setPermissionGranted(false);
  }, [stream, stopRecording]);

  // Attach stream to video element when both are available
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chunkIntervalRef.current) {
        clearInterval(chunkIntervalRef.current);
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  return {
    stream,
    videoRef,
    isRecording,
    error,
    permissionGranted,
    requestPermissions,
    startRecording,
    stopRecording,
    stopStream,
  };
};

export default useMediaStream;
