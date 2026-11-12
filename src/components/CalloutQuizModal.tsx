import React, { useState, useEffect, useRef } from 'react';
import { MapData, Callout, Language } from '../types';
import {
  Gamepad2,
  X,
  Trophy,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  ArrowLeft,
  Sparkles,
  Map as MapIcon,
  ZoomIn,
  ZoomOut,
  Volume2,
  VolumeX,
  MousePointerClick,
  Target,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { resolveAssetPath } from '../utils/assets';
import { playTTS } from '../utils/tts';

interface CalloutQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  maps: MapData[];
  lang: Language;
}

export type QuizMode =
  | 'mode1_classic'
  | 'mode2_short'
  | 'mode3_mapclick_classic'
  | 'mode4_mapclick_short';

const QUIZ_MUTED_STORAGE_KEY = 'cs2_quiz_tts_muted';

export const CalloutQuizModal: React.FC<CalloutQuizModalProps> = ({
  isOpen,
  onClose,
  maps,
  lang,
}) => {
  const isDe = lang === 'de';

  // Filter maps with at least 6 callouts
  const eligibleMaps = maps.filter((m) => (m.callouts?.length || 0) >= 6);

  const [selectedMapId, setSelectedMapId] = useState<string>('');
  const [quizMode, setQuizMode] = useState<QuizMode>('mode1_classic');
  const [isQuizActive, setIsQuizActive] = useState<boolean>(false);

  // Audio Mute State for Map Click Modes (Persisted in localStorage)
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(QUIZ_MUTED_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(QUIZ_MUTED_STORAGE_KEY, String(next));
      } catch (e) {
        console.warn('Failed to save mute preference:', e);
      }
      if (next && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      return next;
    });
  };

  // Quiz game state
  const [questions, setQuestions] = useState<{ callout: Callout; options?: string[] }[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // Map Click State
  const [mapClickedPos, setMapClickedPos] = useState<{ x: number; y: number } | null>(null);
  const [isMapClickCorrect, setIsMapClickCorrect] = useState<boolean | null>(null);

  const [score, setScore] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  // Zoom and Pan state for the map
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Pinch-to-zoom refs
  const initialPinchDistRef = useRef<number | null>(null);
  const initialPinchZoomRef = useRef<number>(1.0);

  // Map element ref for coordinate calculation
  const mapContainerRef = useRef<HTMLDivElement>(null);

  // Confetti interval reference for click-anywhere dismissal
  const confettiIntervalRef = useRef<any>(null);

  const stopConfetti = () => {
    if (confettiIntervalRef.current) {
      clearInterval(confettiIntervalRef.current);
      confettiIntervalRef.current = null;
    }
  };

  useEffect(() => {
    if (eligibleMaps.length > 0 && !selectedMapId) {
      setSelectedMapId(eligibleMaps[0].id);
    }
  }, [eligibleMaps, selectedMapId]);

  // Perfect / High Score Celebration (Confetti)
  useEffect(() => {
    if (isFinished && score > 0 && score >= Math.ceil(questions.length * 0.7)) {
      const duration = 6 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };
      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      confettiIntervalRef.current = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
          stopConfetti();
          return;
        }
        const particleCount = 40 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 300);

      return () => stopConfetti();
    }
  }, [isFinished, score, questions.length]);

  const handleClose = () => {
    stopConfetti();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsQuizActive(false);
    setSelectedOption(null);
    setMapClickedPos(null);
    setIsMapClickCorrect(null);
    setCurrentIndex(0);
    setScore(0);
    setQuestions([]);
    setIsFinished(false);
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    onClose();
  };

  const handleFinishedAnywhereClick = () => {
    stopConfetti();
  };

  if (!isOpen) return null;

  const currentMap = maps.find((m) => m.id === selectedMapId);
  const isMapClickMode =
    quizMode === 'mode3_mapclick_classic' || quizMode === 'mode4_mapclick_short';

  // Direct start when clicking a map card
  const startQuizForMap = (targetMapId: string) => {
    const targetMap = maps.find((m) => m.id === targetMapId);
    if (!targetMap || !targetMap.callouts || targetMap.callouts.length < 6) return;

    setSelectedMapId(targetMapId);
    stopConfetti();

    const validCallouts = [...targetMap.callouts];
    const shuffledCallouts = validCallouts.sort(() => Math.random() - 0.5);

    let count = 10;
    if (quizMode === 'mode2_short' || quizMode === 'mode4_mapclick_short') {
      count = 5;
    } else {
      count = 10;
    }

    const selectedCallouts = shuffledCallouts.slice(0, Math.min(count, shuffledCallouts.length));

    if (isMapClickMode) {
      const generatedQuestions = selectedCallouts.map((c) => ({ callout: c }));
      setQuestions(generatedQuestions);
    } else {
      const generatedQuestions = selectedCallouts.map((targetCallout) => {
        const otherNames = validCallouts
          .filter((c) => c.id !== targetCallout.id)
          .map((c) => c.name);

        const shuffledOthers = otherNames.sort(() => Math.random() - 0.5).slice(0, 3);
        const options = [targetCallout.name, ...shuffledOthers].sort(() => Math.random() - 0.5);

        return {
          callout: targetCallout,
          options,
        };
      });
      setQuestions(generatedQuestions);
    }

    setCurrentIndex(0);
    setScore(0);
    setSelectedOption(null);
    setMapClickedPos(null);
    setIsMapClickCorrect(null);
    setIsFinished(false);
    setIsQuizActive(true);
    setZoom(1.0);
    setPan({ x: 0, y: 0 });

    // Automatic English TTS for Map Click Modes (if not muted)
    if (isMapClickMode && selectedCallouts.length > 0 && !isMuted) {
      const firstCallout = selectedCallouts[0];
      setTimeout(() => {
        playTTS(firstCallout.name);
      }, 300);
    }
  };

  const handleSelectOption = (option: string) => {
    if (selectedOption !== null) return;
    setSelectedOption(option);

    const currentQuestion = questions[currentIndex];
    if (option === currentQuestion.callout.name) {
      setScore((prev) => prev + 1);
    }
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMapClickMode || isMapClickCorrect !== null || !mapContainerRef.current) return;
    if (isPanning) return;

    const rect = mapContainerRef.current.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100 - 50;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100 - 50;

    const target = questions[currentIndex].callout;
    const dx = clickX - target.x;
    const dy = clickY - target.y;
    const dist = Math.hypot(dx, dy);

    let isCorrect = dist <= 12;
    if (target.area) {
      const ax = target.area.x;
      const ay = target.area.y;
      const aw = target.area.width;
      const ah = target.area.height;
      if (clickX >= ax && clickX <= ax + aw && clickY >= ay && clickY <= ay + ah) {
        isCorrect = true;
      }
    }

    setMapClickedPos({ x: clickX, y: clickY });
    setIsMapClickCorrect(isCorrect);
    if (isCorrect) {
      setScore((prev) => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex + 1 < questions.length) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      setSelectedOption(null);
      setMapClickedPos(null);
      setIsMapClickCorrect(null);
      setZoom(1.0);
      setPan({ x: 0, y: 0 });

      if (isMapClickMode && questions[nextIndex] && !isMuted) {
        setTimeout(() => {
          playTTS(questions[nextIndex].callout.name);
        }, 200);
      }
    } else {
      setIsFinished(true);
    }
  };

  const handleZoomChange = (newZoom: number) => {
    const clamped = Math.max(1.0, Math.min(3.0, Math.round(newZoom * 100) / 100));
    setZoom(clamped);
    if (clamped === 1.0) setPan({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!isQuizActive || isFinished) return;
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    handleZoomChange(zoom + delta);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1.0) return;
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - startPan.x,
      y: e.clientY - startPan.y,
    });
  };

  const handleMouseUp = () => setIsPanning(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      initialPinchDistRef.current = dist;
      initialPinchZoomRef.current = zoom;
    } else if (e.touches.length === 1 && zoom > 1.0) {
      const touch = e.touches[0];
      setIsPanning(true);
      setStartPan({ x: touch.clientX - pan.x, y: touch.clientY - pan.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistRef.current) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const factor = currentDist / initialPinchDistRef.current;
      handleZoomChange(initialPinchZoomRef.current * factor);
    } else if (e.touches.length === 1 && isPanning) {
      const touch = e.touches[0];
      setPan({
        x: touch.clientX - startPan.x,
        y: touch.clientY - startPan.y,
      });
    }
  };

  const handleTouchEnd = () => {
    initialPinchDistRef.current = null;
    setIsPanning(false);
  };

  const currentQuestion = questions[currentIndex];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in-50 print:hidden"
      onClick={(e) => {
        if (isFinished) {
          handleFinishedAnywhereClick();
        }
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl text-zinc-100 max-h-[92vh] overflow-y-auto relative"
        onClick={() => {
          if (isFinished) handleFinishedAnywhereClick();
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
                <span>{isDe ? 'CS2 Callout Trainer & Quiz' : 'CS2 Callout Quiz Trainer'}</span>
                <Sparkles className="w-4 h-4 text-amber-400" />
              </h2>
              <p className="text-xs text-zinc-400">
                {isDe
                  ? 'Lerne die Ansagen aller CS2-Karten spielerisch auswendig'
                  : 'Learn and memorize CS2 callouts for all maps interactively'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            title={isDe ? 'Schließen' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SETUP SCREEN: Choose from 4 Modes & Click Map to Start Immediately */}
        {!isQuizActive && (
          <div className="space-y-5">
            {/* Quiz Mode Selection (4 Modi) */}
            <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
                {isDe ? '1. Wähle deinen Spielmodus:' : '1. Choose your game mode:'}
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Mode 1: Classic Multiple Choice (10 Qs) */}
                <button
                  type="button"
                  onClick={() => setQuizMode('mode1_classic')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    quizMode === 'mode1_classic'
                      ? 'border-amber-500 bg-amber-500/15 text-white ring-1 ring-amber-500/50'
                      : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-xs text-white">{isDe ? 'Modus 1' : 'Mode 1'}</span>
                    <Target className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="font-bold text-xs text-amber-300">{isDe ? 'Klassisch (10 Fragen)' : 'Classic (10 Qs)'}</p>
                  <p className="text-[10px] text-zinc-400 mt-1 leading-tight">
                    {isDe ? 'Multiple-Choice-Quiz mit 10 Fragen' : 'Multiple choice quiz with 10 questions'}
                  </p>
                </button>

                {/* Mode 2: Short Multiple Choice (5 Qs) */}
                <button
                  type="button"
                  onClick={() => setQuizMode('mode2_short')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    quizMode === 'mode2_short'
                      ? 'border-amber-500 bg-amber-500/15 text-white ring-1 ring-amber-500/50'
                      : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-xs text-white">{isDe ? 'Modus 2' : 'Mode 2'}</span>
                    <Target className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="font-bold text-xs text-amber-300">{isDe ? 'Kurze Runde (5 Fragen)' : 'Quick Round (5 Qs)'}</p>
                  <p className="text-[10px] text-zinc-400 mt-1 leading-tight">
                    {isDe ? 'Schnelles Multiple-Choice mit 5 Fragen' : 'Quick multiple choice with 5 questions'}
                  </p>
                </button>

                {/* Mode 3: Map Click Classic (10 Qs) */}
                <button
                  type="button"
                  onClick={() => setQuizMode('mode3_mapclick_classic')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    quizMode === 'mode3_mapclick_classic'
                      ? 'border-amber-500 bg-amber-500/15 text-white ring-1 ring-amber-500/50'
                      : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-xs text-white">{isDe ? 'Modus 3' : 'Mode 3'}</span>
                    <MousePointerClick className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="font-bold text-xs text-amber-300">{isDe ? 'Klick auf Karte (10 Fragen)' : 'Map Click Classic (10 Qs)'}</p>
                  <p className="text-[10px] text-zinc-400 mt-1 leading-tight">
                    {isDe ? 'Positionen auf Radar suchen (10 Fragen)' : 'Find positions on radar map (10 Qs)'}
                  </p>
                </button>

                {/* Mode 4: Map Click Short (5 Qs) */}
                <button
                  type="button"
                  onClick={() => setQuizMode('mode4_mapclick_short')}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                    quizMode === 'mode4_mapclick_short'
                      ? 'border-amber-500 bg-amber-500/15 text-white ring-1 ring-amber-500/50'
                      : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-xs text-white">{isDe ? 'Modus 4' : 'Mode 4'}</span>
                    <MousePointerClick className="w-4 h-4 text-amber-400" />
                  </div>
                  <p className="font-bold text-xs text-amber-300">{isDe ? 'Klick auf Karte (5 Fragen)' : 'Map Click Short (5 Qs)'}</p>
                  <p className="text-[10px] text-zinc-400 mt-1 leading-tight">
                    {isDe ? 'Schnelle Radar-Klick-Runde mit 5 Fragen' : 'Quick radar click session with 5 Qs'}
                  </p>
                </button>
              </div>
            </div>

            {/* Choose Map: Directly Starts Quiz on Click */}
            <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
                {isDe ? '2. Klicke auf eine Karte, um das Quiz sofort zu starten:' : '2. Click any map to start quiz immediately:'}
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                {eligibleMaps.map((map) => {
                  return (
                    <button
                      key={map.id}
                      onClick={() => startQuizForMap(map.id)}
                      className="flex items-center gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-900/80 text-zinc-300 hover:border-amber-500 hover:bg-amber-500/10 hover:text-white transition-all cursor-pointer group shadow-sm active:scale-[0.98]"
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-zinc-700 bg-zinc-950 group-hover:border-amber-400">
                        <img
                          src={resolveAssetPath(map.image)}
                          alt={map.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <p className="font-bold text-xs truncate text-white group-hover:text-amber-300">{map.name}</p>
                        <p className="text-[10px] text-amber-400/90 font-mono mt-0.5">
                          {map.callouts.length} Callouts
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ACTIVE QUIZ SCREEN (Mode 1 & Mode 2: Multiple Choice) */}
        {isQuizActive && !isFinished && currentQuestion && !isMapClickMode && (
          <div className="space-y-5">
            {/* Progress Bar & Map Indicator */}
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-400 flex items-center gap-1.5 font-bold">
                <MapIcon className="w-4 h-4 text-amber-400" />
                <span>{currentMap?.name}</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-amber-400 font-bold bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-md">
                  {isDe ? 'Frage' : 'Question'} {currentIndex + 1} / {questions.length}
                </span>
                <span className="text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-md">
                  {isDe ? 'Punkte: ' : 'Score: '} {score}
                </span>
              </div>
            </div>

            <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
              />
            </div>

            {/* Interactive Radar Map View with Target Pin Highlighted */}
            <div
              className="relative w-full aspect-square max-w-[420px] mx-auto rounded-xl border-2 border-amber-500/40 bg-zinc-950 overflow-hidden shadow-2xl cursor-grab active:cursor-grabbing"
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div
                className="w-full h-full transition-transform duration-75"
                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
              >
                <img
                  src={resolveAssetPath(currentMap?.image)}
                  alt={currentMap?.name}
                  className="w-full h-full object-cover pointer-events-none"
                />

                {/* Target Highlight Ring & Pulsing Pin */}
                <div
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
                  style={{
                    left: `${currentQuestion.callout.x + 50}%`,
                    top: `${currentQuestion.callout.y + 50}%`,
                  }}
                >
                  <div className="relative flex items-center justify-center">
                    <span className="absolute w-5 h-5 rounded-full bg-amber-400/30 animate-ping" />
                    <span className="absolute w-2.5 h-2.5 rounded-full bg-amber-500/50 ring-1 ring-amber-300/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-400 ring-[1px] ring-zinc-950 shadow-[0_0_10px_rgba(251,191,36,0.5)] flex items-center justify-center font-black text-[7px] text-zinc-950 z-10">
                      ?
                    </div>
                  </div>
                </div>
              </div>

              {/* Zoom Controls Overlay */}
              <div className="absolute bottom-2 right-2 flex flex-col gap-1 z-40">
                <button
                  onClick={() => handleZoomChange(zoom + 0.5)}
                  className="p-1.5 rounded-lg bg-zinc-900/80 border border-zinc-700 text-white hover:bg-zinc-800 cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleZoomChange(zoom - 0.5)}
                  className="p-1.5 rounded-lg bg-zinc-900/80 border border-zinc-700 text-white hover:bg-zinc-800 cursor-pointer"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            <p className="text-center text-xs font-bold text-zinc-300 uppercase tracking-wider">
              {isDe
                ? 'Wie heißt die markierte Stelle auf der Karte?'
                : 'What is the name of the highlighted position?'}
            </p>

            {/* Multiple Choice Option Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {currentQuestion.options?.map((opt, idx) => {
                const isSelected = selectedOption === opt;
                const isCorrect = opt === currentQuestion.callout.name;
                const isAnswered = selectedOption !== null;

                let btnStyle = 'border-zinc-700 bg-zinc-800/80 text-zinc-200 hover:bg-zinc-700 hover:border-zinc-600';
                if (isAnswered) {
                  if (isCorrect) {
                    btnStyle = 'border-emerald-500 bg-emerald-500/20 text-emerald-200 ring-2 ring-emerald-500/50 font-bold';
                  } else if (isSelected && !isCorrect) {
                    btnStyle = 'border-red-500 bg-red-500/20 text-red-200 ring-2 ring-red-500/50 font-bold';
                  } else {
                    btnStyle = 'border-zinc-800 bg-zinc-900/50 text-zinc-500 opacity-50';
                  }
                }

                return (
                  <button
                    key={idx}
                    onClick={() => handleSelectOption(opt)}
                    disabled={isAnswered}
                    className={`p-3.5 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer flex items-center justify-between ${btnStyle}`}
                  >
                    <span>{opt}</span>
                    {isAnswered && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                    {isAnswered && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Controls: Next Question Button & Restart Quiz Button */}
            <div className="pt-2 space-y-2 animate-in fade-in-50">
              {selectedOption !== null && (
                <button
                  onClick={handleNextQuestion}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black transition-all shadow-md cursor-pointer text-xs uppercase tracking-wider"
                >
                  <span>
                    {currentIndex + 1 < questions.length
                      ? isDe ? 'Nächste Frage' : 'Next Question'
                      : isDe ? 'Ergebnis anzeigen' : 'Show Result'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {/* Split Buttons: Neu starten (links) & Menü (rechts) */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (selectedMapId) startQuizForMap(selectedMapId);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-bold transition-all border border-zinc-700/80 cursor-pointer text-xs uppercase tracking-wider"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isDe ? 'Neu starten' : 'Restart'}</span>
                </button>

                <button
                  onClick={() => {
                    stopConfetti();
                    setIsQuizActive(false);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-bold transition-all border border-zinc-700/80 cursor-pointer text-xs uppercase tracking-wider"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isDe ? 'Menü' : 'Menu'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ACTIVE QUIZ SCREEN (Mode 3 & Mode 4: Map Click Modes) */}
        {isQuizActive && !isFinished && currentQuestion && isMapClickMode && (
          <div className="space-y-4">
            {/* Progress Bar & Map Indicator */}
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-400 flex items-center gap-1.5 font-bold">
                <MapIcon className="w-4 h-4 text-amber-400" />
                <span>{currentMap?.name}</span>
              </span>

              <div className="flex items-center gap-2">
                <span className="text-amber-400 font-bold bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-md">
                  {isDe ? 'Frage' : 'Question'} {currentIndex + 1} / {questions.length}
                </span>
                <span className="text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-md">
                  {isDe ? 'Punkte: ' : 'Score: '} {score}
                </span>
              </div>
            </div>

            <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
              />
            </div>

            {/* Question Banner with Stummknopf directly left next to Anhören */}
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-2 min-w-0">
                <MousePointerClick className="w-5 h-5 text-amber-400 shrink-0" />
                <span className="text-xs sm:text-sm font-black text-white truncate">
                  {isDe ? 'Wo befindet sich ' : 'Where is '}
                  <span className="text-amber-400 underline decoration-amber-400/50">{currentQuestion.callout.name}</span>
                  {isDe ? ` auf ${currentMap?.name}?` : ` on ${currentMap?.name}?`}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-auto">
                {/* Stumm-Knopf direkt links neben Anhören */}
                <button
                  type="button"
                  onClick={toggleMute}
                  className={`p-1.5 rounded-lg border text-xs transition-all cursor-pointer shadow-sm active:scale-95 ${
                    isMuted
                      ? 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30'
                      : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                  }`}
                  title={isMuted ? (isDe ? 'Sprachausgabe aktivieren' : 'Unmute audio') : (isDe ? 'Sprachausgabe stummschalten' : 'Mute audio')}
                >
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>

                {/* Anhören Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (!isMuted) playTTS(currentQuestion.callout.name);
                  }}
                  disabled={isMuted}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer shadow-sm active:scale-95 ${
                    isMuted
                      ? 'bg-zinc-800 text-zinc-500 border border-zinc-700 opacity-50 cursor-not-allowed'
                      : 'bg-amber-400 text-zinc-950 hover:bg-amber-300'
                  }`}
                  title={isMuted ? (isDe ? 'Audio ist stummgeschaltet' : 'Audio is muted') : (isDe ? 'Englische Ansage vorlesen' : 'Play English audio')}
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  <span>{isDe ? 'Anhören' : 'Listen'}</span>
                </button>
              </div>
            </div>

            {/* Interactive Radar Map for Click Modes */}
            <div
              ref={mapContainerRef}
              onClick={handleMapClick}
              className={`relative w-full aspect-square max-w-[440px] mx-auto rounded-xl border-2 border-amber-500/40 bg-zinc-950 overflow-hidden shadow-2xl ${
                isMapClickCorrect === null ? 'cursor-crosshair' : 'cursor-default'
              }`}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div
                className="w-full h-full transition-transform duration-75"
                style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
              >
                <img
                  src={resolveAssetPath(currentMap?.image)}
                  alt={currentMap?.name}
                  className="w-full h-full object-cover pointer-events-none"
                />

                {/* Render user's clicked position marker */}
                {mapClickedPos && (
                  <div
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
                    style={{
                      left: `${mapClickedPos.x + 50}%`,
                      top: `${mapClickedPos.y + 50}%`,
                    }}
                  >
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center font-bold text-[10px] shadow-lg ${
                        isMapClickCorrect
                          ? 'border-emerald-400 bg-emerald-500/40 text-white animate-bounce'
                          : 'border-red-500 bg-red-500/40 text-white'
                      }`}
                    >
                      {isMapClickCorrect ? '✓' : '✕'}
                    </div>
                  </div>
                )}

                {/* Show real target position once answered */}
                {isMapClickCorrect !== null && (
                  <div
                    className="absolute transform -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none"
                    style={{
                      left: `${currentQuestion.callout.x + 50}%`,
                      top: `${currentQuestion.callout.y + 50}%`,
                    }}
                  >
                    <div className="flex flex-col items-center">
                      <div className="px-2 py-0.5 rounded bg-emerald-500 text-zinc-950 font-black text-[10px] shadow-md uppercase whitespace-nowrap mb-1">
                        {currentQuestion.callout.name}
                      </div>
                      <div className="w-5 h-5 rounded-full border-2 border-emerald-400 bg-emerald-500/60 ring-4 ring-emerald-400/30 animate-pulse flex items-center justify-center text-white text-[10px] font-bold">
                        ★
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Zoom Controls Overlay */}
              <div className="absolute bottom-2 right-2 flex flex-col gap-1 z-40">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleZoomChange(zoom + 0.5);
                  }}
                  className="p-1.5 rounded-lg bg-zinc-900/80 border border-zinc-700 text-white hover:bg-zinc-800 cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleZoomChange(zoom - 0.5);
                  }}
                  className="p-1.5 rounded-lg bg-zinc-900/80 border border-zinc-700 text-white hover:bg-zinc-800 cursor-pointer"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Answer Feedback Banner & Controls */}
            <div className="space-y-3">
              {isMapClickCorrect !== null && (
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold animate-in fade-in-50 ${
                    isMapClickCorrect
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-red-500/20 border-red-500/50 text-red-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isMapClickCorrect ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400" />
                    )}
                    <span>
                      {isMapClickCorrect
                        ? isDe ? 'Super! Perfekt getroffen!' : 'Great job! Perfect hit!'
                        : isDe ? `Knapp daneben! Die genaue Stelle ist oben grün markiert.` : `Missed! The correct spot is marked in green.`}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-1">
                {isMapClickCorrect !== null && (
                  <button
                    onClick={handleNextQuestion}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black transition-all shadow-md cursor-pointer text-xs uppercase tracking-wider"
                  >
                    <span>
                      {currentIndex + 1 < questions.length
                        ? isDe ? 'Nächste Frage' : 'Next Question'
                        : isDe ? 'Ergebnis anzeigen' : 'Show Result'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}

                {/* Split Buttons: Neu starten (links) & Menü (rechts) */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (selectedMapId) startQuizForMap(selectedMapId);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-bold transition-all border border-zinc-700/80 cursor-pointer text-xs uppercase tracking-wider"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isDe ? 'Neu starten' : 'Restart'}</span>
                  </button>

                  <button
                    onClick={() => {
                      stopConfetti();
                      setIsQuizActive(false);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-bold transition-all border border-zinc-700/80 cursor-pointer text-xs uppercase tracking-wider"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
                    <span>{isDe ? 'Menü' : 'Menu'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* FINISHED RESULT SCREEN */}
        {isQuizActive && isFinished && (
          <div
            className="space-y-6 text-center py-4 animate-in fade-in-50 cursor-pointer select-none"
            onClick={handleFinishedAnywhereClick}
          >
            <div className="inline-flex p-4 rounded-full bg-amber-500/10 border-2 border-amber-500/30 text-amber-400 mx-auto">
              <Trophy className="w-12 h-12" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-white uppercase tracking-wider">
                {isDe ? 'Quiz Beendet!' : 'Quiz Finished!'}
              </h3>
              <p className="text-xs text-zinc-400">
                {isDe ? `Karte: ${currentMap?.name}` : `Map: ${currentMap?.name}`}
              </p>
              <p className="text-[11px] text-zinc-500 italic">
                {isDe ? '(Klicke irgendwohin, um die Gewinner-Animation zu beenden)' : '(Click anywhere to stop celebration animation)'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 inline-block px-8">
              <span className="text-3xl font-black text-amber-400">
                {score} / {questions.length}
              </span>
              <p className="text-[11px] text-zinc-400 mt-1">
                {Math.round((score / (questions.length || 1)) * 100)}% {isDe ? 'Richtig beantwortet' : 'Correct'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (selectedMapId) startQuizForMap(selectedMapId);
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black transition-all shadow-md cursor-pointer text-xs uppercase tracking-wider"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{isDe ? 'Nochmal spielen' : 'Play Again'}</span>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  stopConfetti();
                  setIsQuizActive(false);
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-white font-bold transition-all cursor-pointer text-xs"
              >
                <span>{isDe ? 'Andere Karte wählen' : 'Change Map'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper ZapIcon component for Mode 2
function ZapIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
