import React, { useState, useRef } from 'react';
import TextViewer from './components/TextViewer';
import { generateWordTimings } from './services/geminiService';
import { PlayIcon, PauseIcon, StopIcon, LoadingIcon, ExportIcon } from './constants';
import type { WordTiming, ViewElement } from './types';

type AppState = 'input' | 'loading' | 'ready' | 'error';

const fileToBase64 = (file: File): Promise<{ base64: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const [mime, data] = result.split(';base64,');
      if (!mime || !data) {
        return reject(new Error('Invalid file format.'));
      }
      const mimeType = mime.split(':')[1];
      resolve({ base64: data, mimeType });
    };
    reader.onerror = (error) => reject(error);
  });
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('input');
  
  // Input state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [textInput, setTextInput] = useState<string>('');
  
  // Ready/playback state
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [wordTimings, setWordTimings] = useState<WordTiming[]>([]);
  const [viewElements, setViewElements] = useState<ViewElement[]>([]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [activeWordIndex, setActiveWordIndex] = useState<number>(-1);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAudioFile(file);
      const objectUrl = URL.createObjectURL(file);
      setAudioSrc(objectUrl);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!audioFile || !textInput.trim()) {
      setError('Please provide both an audio file and the transcript text.');
      return;
    }
    setAppState('loading');
    setError(null);
    try {
      const { base64, mimeType } = await fileToBase64(audioFile);
      const timings = await generateWordTimings(base64, mimeType, textInput);
      setWordTimings(timings);

      const newViewElements: ViewElement[] = [];
      let textCursor = 0;
      timings.forEach((timing, index) => {
        const wordStartIndex = textInput.indexOf(timing.word, textCursor);

        if (wordStartIndex === -1) {
            console.warn(`Could not find word "${timing.word}" in transcript starting from index ${textCursor}. Appending word without preceding whitespace.`);
             newViewElements.push({ type: 'word', ...timing, originalIndex: index });
             return;
        }

        const whitespaceContent = textInput.substring(textCursor, wordStartIndex);
        if (whitespaceContent) {
            newViewElements.push({ type: 'whitespace', content: whitespaceContent });
        }
        
        newViewElements.push({ type: 'word', ...timing, originalIndex: index });
        textCursor = wordStartIndex + timing.word.length;
      });

      const remainingWhitespace = textInput.substring(textCursor);
      if (remainingWhitespace) {
          newViewElements.push({ type: 'whitespace', content: remainingWhitespace });
      }

      setViewElements(newViewElements);
      setAppState('ready');
    } catch (err) {
      console.error("Error generating word timings:", err);
      setError("Failed to synchronize audio and text. The model may have been unable to process the request. Please try again with a clearer audio file or more accurate transcript.");
      setAppState('error');
    }
  };
  
  const handleResetApp = () => {
    if (audioSrc) URL.revokeObjectURL(audioSrc);
    setAppState('input');
    setAudioFile(null);
    setTextInput('');
    setAudioSrc(null);
    setWordTimings([]);
    setViewElements([]);
    setError(null);
    setIsPlaying(false);
    setActiveWordIndex(-1);
  };
  
  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const currentTime = audioRef.current.currentTime;
    const currentWordIndex = wordTimings.findIndex(
      (timing) => currentTime >= timing.start && currentTime < timing.end
    );
    if(currentWordIndex !== -1) {
        setActiveWordIndex(currentWordIndex);
    }
  };

  const handlePlaybackEnd = () => {
    setIsPlaying(false);
    setActiveWordIndex(-1);
  };

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleStop = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
    setActiveWordIndex(-1);
  };

  const handleExportVideo = async () => {
    if (!audioRef.current || !wordTimings.length || isExporting) return;
    setIsExporting(true);

    const audioEl = audioRef.current;

    const exportProcess = () => {
        // 2. Setup Canvas
        const canvas = document.createElement('canvas');
        const FONT_SIZE = 48;
        const PADDING = 60;
        const LINE_HEIGHT = FONT_SIZE * 1.8;
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            setIsExporting(false);
            return;
        }

        // Set RTL properties for Arabic text
        ctx.direction = 'rtl';
        ctx.textAlign = 'right';
        ctx.font = `500 ${FONT_SIZE}px 'Noto Naskh Arabic', serif`;
        
        interface CanvasLayout {
            word: string;
            x: number;
            y: number;
            width: number;
            originalIndex: number;
        }
        const wordLayouts: CanvasLayout[] = [];
        let currentX = canvas.width - PADDING; // Start from the right edge
        let currentY = PADDING + FONT_SIZE;

        viewElements.forEach(element => {
            if (element.type === 'word') {
                const word = element.word;
                const metrics = ctx.measureText(word);
                
                if (currentX - metrics.width < PADDING) { // Check left boundary
                    currentY += LINE_HEIGHT;
                    currentX = canvas.width - PADDING; // Reset to right edge
                }
                
                // x is the right edge of the word due to textAlign='right'
                wordLayouts.push({ word, x: currentX, y: currentY, width: metrics.width, originalIndex: element.originalIndex });
                currentX -= metrics.width; // Move cursor left
            } else { // whitespace
                for (const char of element.content) {
                    if (char === '\n') {
                        currentY += LINE_HEIGHT;
                        currentX = canvas.width - PADDING; // Reset to right edge
                    } else {
                        const spaceMetrics = ctx.measureText(char);
                        if (currentX - spaceMetrics.width < PADDING) { // Check left boundary
                            currentY += LINE_HEIGHT;
                            currentX = canvas.width - PADDING;
                        } else {
                            currentX -= spaceMetrics.width; // Move cursor left
                        }
                    }
                }
            }
        });
        
        const lastLineY = wordLayouts.length > 0 ? Math.max(...wordLayouts.map(l => l.y)) : 0;
        const totalTextHeight = lastLineY + PADDING;


        // 3. Setup Audio & Video Streams for recording
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const sourceNode = audioCtx.createMediaElementSource(audioEl);
        const dest = audioCtx.createMediaStreamDestination();
        sourceNode.connect(dest);
        
        const audioTrack = dest.stream.getAudioTracks()[0];
        const videoStream = canvas.captureStream(30);
        const videoTrack = videoStream.getVideoTracks()[0];
        
        const combinedStream = new MediaStream([videoTrack, audioTrack]);
        const recorder = new MediaRecorder(combinedStream, { 
          mimeType: 'video/webm; codecs=vp9,opus',
          audioBitsPerSecond: 128000,
          videoBitsPerSecond: 2500000,
        });
        
        const chunks: Blob[] = [];
        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) chunks.push(event.data);
        };

        let animationFrameId: number;

        recorder.onstop = () => {
            cancelAnimationFrame(animationFrameId); // Stop the rendering loop

            // Create and download the video file
            const blob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'synced-video.webm';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            // Cleanup
            setIsExporting(false);
            sourceNode.disconnect();
            audioCtx.close();
            handleStop(); // Reset player state for the user
        };

        // 4. The Rendering Loop - driven by audio's current time
        let currentScrollY = 0;
        let targetScrollY = 0;
        const LERP_FACTOR = 0.08; // Smoothing factor for camera pan

        const renderFrame = () => {
            const currentTime = audioEl.currentTime;
            const activeIndex = wordTimings.findIndex(t => currentTime >= t.start && currentTime < t.end);

            // Background
            ctx.fillStyle = '#f9fafb'; // gray-50
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.save(); // Save context state before translation

            // Calculate vertical scroll to center the active line
            if (totalTextHeight > canvas.height) {
                const activeLayout = wordLayouts.find(l => l.originalIndex === activeIndex);
                if (activeLayout) {
                    targetScrollY = activeLayout.y - (canvas.height / 2);
                }
                // Clamp the target to prevent overscrolling
                const maxScrollTop = totalTextHeight - canvas.height;
                targetScrollY = Math.max(0, Math.min(targetScrollY, maxScrollTop));

                // Smoothly interpolate the current scroll position towards the target
                currentScrollY += (targetScrollY - currentScrollY) * LERP_FACTOR;
                // Snap to target if very close to prevent endless tiny adjustments
                if (Math.abs(targetScrollY - currentScrollY) < 0.5) {
                    currentScrollY = targetScrollY;
                }

                ctx.translate(0, -currentScrollY);
            }
            
            // Set context properties for each frame to be safe
            ctx.direction = 'rtl';
            ctx.textAlign = 'right';
            ctx.font = `500 ${FONT_SIZE}px 'Noto Naskh Arabic', serif`;

            // Draw words
            wordLayouts.forEach((layout) => {
                if (layout.originalIndex === activeIndex) {
                    // Highlight
                    ctx.fillStyle = 'rgba(253, 224, 71, 0.6)'; // yellow-300/60
                    // For RTL, rect x is layout.x - layout.width
                    ctx.fillRect(layout.x - layout.width - 5, layout.y - FONT_SIZE - 5, layout.width + 10, LINE_HEIGHT);
                    ctx.fillStyle = '#111827'; // gray-900 for active text
                } else {
                    ctx.fillStyle = '#374151'; // gray-700 for inactive text
                }
                ctx.fillText(layout.word, layout.x, layout.y);
            });

            ctx.restore(); // Restore context state to prevent affecting next frame's background

            animationFrameId = requestAnimationFrame(renderFrame);
        };

        // 5. Start everything in order
        const onAudioEnded = () => {
            if (recorder.state === 'recording') {
                recorder.stop();
            }
            audioEl.removeEventListener('ended', onAudioEnded);
        };

        audioEl.addEventListener('ended', onAudioEnded);
        
        recorder.start();
        audioEl.play().catch(e => {
            console.error("Audio playback failed to start for recording:", e);
            if (recorder.state === 'recording') recorder.stop();
            setError("Could not start audio playback for recording.");
            setIsExporting(false);
        });
        animationFrameId = requestAnimationFrame(renderFrame);
    };

    // 1. Stop any current playback and reset UI state
    audioEl.pause();
    setIsPlaying(false);
    setActiveWordIndex(-1);

    // 2. Ensure audio is at the beginning before starting the export
    if (audioEl.currentTime === 0) {
        exportProcess();
    } else {
        audioEl.addEventListener('seeked', exportProcess, { once: true });
        audioEl.currentTime = 0;
    }
  };


  const renderContent = () => {
    switch (appState) {
      case 'loading':
        return (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <LoadingIcon size={64}/>
            <p className="mt-4 text-gray-700 text-lg">Synchronizing your audio and text...</p>
            <p className="text-gray-500 text-sm">This may take a moment.</p>
          </div>
        );
      case 'ready':
        return (
          <div className="flex flex-col h-[75vh]">
            <div className="flex-grow overflow-y-auto pr-2">
              <TextViewer viewElements={viewElements} activeWordIndex={activeWordIndex} />
            </div>
            {audioSrc && (
              <div className="flex-shrink-0">
                <audio
                  ref={audioRef}
                  src={audioSrc}
                  onTimeUpdate={handleTimeUpdate}
                  onEnded={handlePlaybackEnd}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  className="hidden"
                />
                <div className="mt-8 flex items-center justify-center gap-4 md:gap-6">
                   <button
                      onClick={handleStop}
                      disabled={isExporting}
                      className="p-4 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-800 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Stop Playback"
                    >
                      <StopIcon />
                    </button>
                    <button
                      onClick={togglePlayPause}
                      disabled={isExporting}
                      className="p-5 w-20 h-20 flex items-center justify-center rounded-full bg-yellow-400 hover:bg-yellow-500 text-black transition-colors duration-200 shadow-lg shadow-yellow-500/30 focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isPlaying ? <PauseIcon /> : <PlayIcon />}
                    </button>
                    <button 
                      onClick={handleExportVideo}
                      disabled={isExporting}
                      className="p-4 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-800 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Export Video"
                    >
                      {isExporting ? <LoadingIcon size={24} /> : <ExportIcon />}
                    </button>
                </div>
                 {isExporting && <p className="text-center text-yellow-600 mt-4 animate-pulse">Exporting video, please wait...</p>}
                 <div className="text-center mt-6">
                    <button 
                        onClick={handleResetApp}
                        disabled={isExporting}
                        className="px-4 py-2 rounded-full bg-gray-200/50 hover:bg-gray-300/50 text-gray-700 transition-colors duration-200 text-sm disabled:opacity-50"
                        aria-label="Start Over"
                        >
                        Start Over
                    </button>
                 </div>
              </div>
            )}
          </div>
        );
      case 'input':
      case 'error':
      default:
        return (
            <div className="flex flex-col gap-6 max-w-4xl mx-auto">
                <div>
                    <label htmlFor="audio-upload" className="block text-sm font-medium text-gray-700 mb-2">1. Upload Voice-over File</label>
                    <input 
                        id="audio-upload" 
                        type="file" 
                        accept="audio/*" 
                        onChange={handleFileChange}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-yellow-400/20 file:text-yellow-800 hover:file:bg-yellow-400/30 transition-colors duration-200"
                    />
                </div>
                {audioSrc && <audio controls src={audioSrc} className="w-full"></audio>}
                <div>
                    <label htmlFor="text-input" className="block text-sm font-medium text-gray-700 mb-2">2. Paste Full Transcript</label>
                    <textarea 
                        id="text-input"
                        rows={8}
                        value={textInput}
                        onChange={(e) => { setTextInput(e.target.value); setError(null); }}
                        placeholder="Paste the exact text from your audio file here..."
                        className="w-full p-4 rounded-lg bg-white border border-gray-300 focus:ring-2 focus:ring-yellow-500 focus:outline-none transition-colors duration-200 text-black placeholder-gray-400"
                    />
                </div>
                {error && <div className="text-center text-red-700 bg-red-100 p-3 rounded-lg"><p>{error}</p></div>}
                <button 
                    onClick={handleSubmit} 
                    disabled={!audioFile || !textInput.trim()}
                    className="w-full py-3 px-6 rounded-full bg-yellow-400 hover:bg-yellow-500 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-yellow-500/30 focus:outline-none focus:ring-2 focus:ring-yellow-300 focus:ring-offset-2 focus:ring-offset-white font-bold text-lg text-black"
                >
                    Synchronize & Play
                </button>
            </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center p-4 text-black">
      <div className="w-full bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-6 md:p-10 border border-gray-200">
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-amber-600 tracking-wide">
            GPS -Audio-Text Sync Player
          </h1>
          <p className="text-gray-600 mt-2 text-lg">
            Upload your own audio and text for a synchronized reading experience.
          </p>
        </header>
        <main>
          {renderContent()}
        </main>
      </div>
      <footer className="mt-8 text-center text-sm text-gray-500">
        <p>Powered by Gemini API</p>
      </footer>
    </div>
  );
};

export default App;
