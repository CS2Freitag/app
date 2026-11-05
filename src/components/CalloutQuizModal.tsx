import React, { useState, useEffect } from 'react';
import { MapData, Callout, Language } from '../types';
import { Gamepad2, X, Trophy, CheckCircle2, XCircle, ArrowRight, RotateCcw, Target, Sparkles, Map as MapIcon } from 'lucide-react';
import { resolveAssetPath } from '../utils/assets';

interface CalloutQuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  maps: MapData[];
  lang: Language;
}

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
  const [isQuizActive, setIsQuizActive] = useState<boolean>(false);

  // Quiz game state
  const [questions, setQuestions] = useState<{ callout: Callout; options: string[] }[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [score, setScore] = useState<number>(0);
  const [isFinished, setIsFinished] = useState<boolean>(false);

  useEffect(() => {
    if (eligibleMaps.length > 0 && !selectedMapId) {
      setSelectedMapId(eligibleMaps[0].id);
    }
  }, [eligibleMaps, selectedMapId]);

  if (!isOpen) return null;

  const currentMap = maps.find((m) => m.id === selectedMapId);

  const startQuiz = () => {
    if (!currentMap || !currentMap.callouts || currentMap.callouts.length < 6) return;

    // Shuffle and pick 8 random callouts (or all callouts if less than 8)
    const validCallouts = [...currentMap.callouts];
    const shuffledCallouts = validCallouts.sort(() => Math.random() - 0.5);
    const selectedQuestionsCallouts = shuffledCallouts.slice(0, Math.min(10, shuffledCallouts.length));

    // Generate multiple choice options for each question
    const generatedQuestions = selectedQuestionsCallouts.map((targetCallout) => {
      const otherNames = validCallouts
        .filter((c) => c.id !== targetCallout.id)
        .map((c) => c.name);

      // Pick 3 random wrong options
      const shuffledOthers = otherNames.sort(() => Math.random() - 0.5).slice(0, 3);
      const options = [targetCallout.name, ...shuffledOthers].sort(() => Math.random() - 0.5);

      return {
        callout: targetCallout,
        options,
      };
    });

    setQuestions(generatedQuestions);
    setCurrentIndex(0);
    setScore(0);
    setSelectedOption(null);
    setIsFinished(false);
    setIsQuizActive(true);
  };

  const handleSelectOption = (option: string) => {
    if (selectedOption !== null) return; // Prevent changing choice
    setSelectedOption(option);

    const currentQuestion = questions[currentIndex];
    if (option === currentQuestion.callout.name) {
      setScore((prev) => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
    } else {
      setIsFinished(true);
    }
  };

  const currentQuestion = questions[currentIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto animate-in fade-in-50">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl text-zinc-100 max-h-[92vh] overflow-y-auto relative">
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
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SETUP SCREEN: Choose Map */}
        {!isQuizActive && (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
                {isDe ? 'Wähle eine Karte für das Quiz:' : 'Select a map for the quiz:'}
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[320px] overflow-y-auto pr-1">
                {eligibleMaps.map((map) => {
                  const isSelected = map.id === selectedMapId;
                  return (
                    <button
                      key={map.id}
                      onClick={() => setSelectedMapId(map.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-amber-500 bg-amber-500/10 text-white shadow-sm ring-1 ring-amber-500/40'
                          : 'border-zinc-800 bg-zinc-900/80 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-zinc-700 bg-zinc-950">
                        <img
                          src={resolveAssetPath(map.image)}
                          alt={map.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs truncate text-white">{map.name}</p>
                        <p className="text-[10px] text-amber-400/90 font-mono mt-0.5">
                          {map.callouts.length} Callouts
                        </p>
                      </div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Start Quiz Button */}
            <button
              onClick={startQuiz}
              disabled={!selectedMapId}
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black transition-all shadow-lg active:scale-[0.98] cursor-pointer text-sm uppercase tracking-wider disabled:opacity-50"
            >
              <Target className="w-5 h-5" />
              <span>{isDe ? 'Quiz jetzt starten' : 'Start Quiz Now'}</span>
            </button>
          </div>
        )}

        {/* ACTIVE QUIZ SCREEN */}
        {isQuizActive && !isFinished && currentQuestion && (
          <div className="space-y-5">
            {/* Progress Bar & Map Indicator */}
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-zinc-400 flex items-center gap-1.5 font-bold">
                <MapIcon className="w-4 h-4 text-amber-400" />
                <span>{currentMap?.name}</span>
              </span>
              <span className="text-amber-400 font-bold bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 rounded-md">
                {isDe ? 'Frage' : 'Question'} {currentIndex + 1} / {questions.length}
              </span>
              <span className="text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-md">
                {isDe ? 'Punkte: ' : 'Score: '} {score}
              </span>
            </div>

            <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
              />
            </div>

            {/* Interactive Radar Map View with Target Pin Highlighted */}
            <div className="relative w-full aspect-square max-w-[420px] mx-auto rounded-xl border-2 border-amber-500/40 bg-zinc-950 overflow-hidden shadow-2xl">
              <img
                src={resolveAssetPath(currentMap?.image)}
                alt={currentMap?.name}
                className="w-full h-full object-cover"
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
                  <span className="absolute w-10 h-10 rounded-full bg-amber-400/40 animate-ping" />
                  <span className="absolute w-6 h-6 rounded-full bg-amber-500/60 ring-2 ring-amber-300 animate-pulse" />
                  <div className="w-4 h-4 rounded-full bg-amber-400 ring-2 ring-zinc-950 shadow-lg flex items-center justify-center font-black text-[9px] text-zinc-950">
                    ?
                  </div>
                </div>
              </div>
            </div>

            <p className="text-center text-xs font-bold text-zinc-300 uppercase tracking-wider">
              {isDe
                ? 'Wie heißt die markierte Stelle auf der Karte?'
                : 'What is the name of the highlighted position?'}
            </p>

            {/* Multiple Choice Option Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {currentQuestion.options.map((opt, idx) => {
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

            {/* Next Question Button */}
            {selectedOption !== null && (
              <div className="pt-2 animate-in fade-in-50">
                <button
                  onClick={handleNextQuestion}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black transition-all shadow-md cursor-pointer text-xs uppercase tracking-wider"
                >
                  <span>{currentIndex + 1 < questions.length ? (isDe ? 'Nächste Frage' : 'Next Question') : (isDe ? 'Ergebnis anzeigen' : 'Show Result')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* FINISHED RESULT SCREEN */}
        {isQuizActive && isFinished && (
          <div className="space-y-6 text-center py-4 animate-in fade-in-50">
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
            </div>

            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 inline-block px-8">
              <span className="text-3xl font-black text-amber-400">
                {score} / {questions.length}
              </span>
              <p className="text-[11px] text-zinc-400 mt-1">
                {Math.round((score / questions.length) * 100)}% {isDe ? 'Richtig beantwortet' : 'Correct'}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={startQuiz}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black transition-all shadow-md cursor-pointer text-xs uppercase tracking-wider"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{isDe ? 'Nochmal spielen' : 'Play Again'}</span>
              </button>

              <button
                onClick={() => setIsQuizActive(false)}
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
