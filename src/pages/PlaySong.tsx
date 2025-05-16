import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import SongQueue from '@/components/SongQueue';
import { Input } from '@/components/ui/input';
import { getSongByNumber, getQueue, generateScore, addToRanking, removeFromQueue, getSettings, getSongs } from '@/services/dataService';
import { Song, QueueItem, AppSettings } from '@/types/song';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Music } from 'lucide-react';

// Helper function to extract filename from path
const getFilenameFromPath = (filepath: string): string => {
  // Remove any quotes from the entire path
  const cleanPath = filepath.replace(/["']/g, '');
  // Handle both forward and backward slashes
  const normalizedPath = cleanPath.replace(/\\/g, '/');
  return normalizedPath.split('/').pop() || cleanPath;
};

const PlaySong = () => {
  const { songNumber } = useParams();
  const navigate = useNavigate();
  const [song, setSong] = useState<Song | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [showScore, setShowScore] = useState(false);
  const [score, setScore] = useState(0);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isAnimatingScore, setIsAnimatingScore] = useState(false);
  const [displayedScore, setDisplayedScore] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isPerformanceIncomplete, setIsPerformanceIncomplete] = useState(false);
  const drumSoundRef = useRef<HTMLAudioElement | null>(null);
  const incompleteSoundRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const loadSong = async () => {
      if (songNumber) {
        console.log('Carregando música número:', songNumber);
        const song = await getSongByNumber(songNumber);
        if (song) {
          console.log('Música encontrada:', song);
          setSong(song);
          
          // Buscar configurações para determinar o caminho do vídeo
          const settingsData = await getSettings();
          setSettings(settingsData);
          
          // Construir URL do vídeo usando o servidor local
          const videoUrl = `http://localhost:3001/videos/${song.number}.mp4`;
          console.log('URL do vídeo:', videoUrl);
          setVideoUrl(videoUrl);

          // Buscar a fila atual
          const queueData = await getQueue();
          setQueue(queueData);

          // Se a música está na fila, remover da fila
          const songInQueue = queueData.find(item => item.song.number === songNumber);
          if (songInQueue) {
            const queueIndex = queueData.indexOf(songInQueue);
            await removeFromQueue(queueIndex);
            const updatedQueue = await getQueue();
            setQueue(updatedQueue);
          }
        } else {
          console.error('Música não encontrada');
          navigate('/');
        }
      }
    };

    loadSong();
  }, [songNumber, navigate]);

  // Simulando o fim do vídeo após 10 segundos (para demonstração)
  useEffect(() => {
    if (!videoUrl) return;
    
    const timer = setTimeout(() => {
      handleSongEnd();
    }, 10000);

    return () => clearTimeout(timer);
  }, [videoUrl]);

  const handleVideoStart = () => {
    setStartTime(Date.now());
  };

  const handleSongEnd = async () => {
    if (!startTime) return;

    const performanceTime = (Date.now() - startTime) / 1000; // Tempo em segundos
    const minimumTime = 60; // 1 minuto em segundos

    if (performanceTime < minimumTime) {
      setIsPerformanceIncomplete(true);
      setShowScore(true);
      
      // Tocar som de performance incompleta usando o servidor local
      if (settings?.soundEffects?.incomplete) {
        try {
          console.log("Todas as configurações:", settings);
          console.log("Configurações de som:", settings.soundEffects);
          console.log("Caminho do som incompleto original:", settings.soundEffects.incomplete);
          
          const filename = getFilenameFromPath(settings.soundEffects.incomplete);
          const audioUrl = `http://localhost:3001/sounds/${filename}`;
          console.log("Nome do arquivo limpo:", filename);
          console.log("URL final do áudio:", audioUrl);
          
          // Tentar fazer uma requisição fetch primeiro para verificar se o arquivo existe
          fetch(audioUrl)
            .then(response => {
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              console.log("Arquivo de áudio encontrado no servidor");
              
              const audio = new Audio(audioUrl);
              
              audio.onerror = (e) => {
                console.error("Erro ao carregar áudio:", e);
                console.error("Código do erro:", (audio as any).error?.code);
                console.error("Mensagem do erro:", (audio as any).error?.message);
              };
              
              audio.oncanplay = () => {
                console.log("Áudio pronto para tocar");
              };
              
              return audio.play();
            })
            .catch(error => {
              console.error("Erro ao verificar/tocar o arquivo de áudio:", error);
            });
            
        } catch (error) {
          console.error("Erro ao tocar áudio de performance incompleta:", error);
        }
      } else {
        console.log("Nenhum som de performance incompleta configurado");
      }
      
      // Voltar para a página inicial após 6 segundos
      setTimeout(() => {
        navigate('/');
      }, 6000);
      
      return;
    }

    const generatedScore = generateScore();
    setScore(generatedScore);
    
    // Iniciar animação de números aleatórios
    setIsAnimatingScore(true);
    setDisplayedScore(Math.floor(Math.random() * (100 - 65 + 1)) + 65);
    
    // Tocar som de tambores se disponível
    if (settings?.soundEffects?.drums) {
      try {
        const audio = new Audio(`http://localhost:3001/sounds/${getFilenameFromPath(settings.soundEffects.drums)}`);
        await audio.play();
      } catch (error) {
        console.error("Erro ao tocar áudio de tambores:", error);
      }
    }
    
    // Esperar 7 segundos para mostrar a pontuação real
    setTimeout(async () => {
      setIsAnimatingScore(false);
      setDisplayedScore(generatedScore);
      setShowScore(true);
      
      // Tocar som baseado na pontuação
      let soundToPlay: string | undefined;
      
      if (generatedScore >= 90 && settings?.soundEffects?.high) {
        soundToPlay = settings.soundEffects.high;
      } else if (generatedScore >= 75 && settings?.soundEffects?.medium) {
        soundToPlay = settings.soundEffects.medium;
      } else if (settings?.soundEffects?.low) {
        soundToPlay = settings.soundEffects.low;
      }
      
      if (soundToPlay) {
        try {
          const audio = new Audio(`http://localhost:3001/sounds/${getFilenameFromPath(soundToPlay)}`);
          await audio.play();
        } catch (error) {
          console.error("Erro ao tocar áudio da pontuação:", error);
        }
      }
      
      // Se houver um item na fila, adicione ao ranking e remova da fila
      const processQueue = async () => {
        if (queue.length > 0 && song) {
          await addToRanking({
            song: song,
            singer: queue[0].singer,
            score: generatedScore
          });
          await removeFromQueue(0);
          const updatedQueue = await getQueue();
          setQueue(updatedQueue);
        }
      };
      
      await processQueue();
      
      // Voltar para a página inicial após 6 segundos
      setTimeout(() => {
        navigate('/');
      }, 6000);
    }, 7000);
  };

  // Efeito para atualizar o número aleatório durante a animação
  useEffect(() => {
    if (!isAnimatingScore) return;
    
    const interval = setInterval(() => {
      setDisplayedScore(Math.floor(Math.random() * 100));
    }, 100);
    
    return () => clearInterval(interval);
  }, [isAnimatingScore]);

  // Contagem regressiva para retornar à tela inicial
  useEffect(() => {
    if (countdown === null) return;
    
    if (countdown <= 0) {
      navigate('/');
      return;
    }
    
    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [countdown, navigate]);

  const handleStopPerformance = async () => {
    if (!startTime || !videoRef.current) return;

    const performanceTime = (Date.now() - startTime) / 1000;
    const minimumTime = 60;

    // Parar o vídeo
    videoRef.current.pause();

    if (performanceTime < minimumTime) {
      setIsPerformanceIncomplete(true);
      setShowScore(true);
      
      // Tocar som de performance incompleta usando o servidor local
      if (settings?.soundEffects?.incomplete) {
        try {
          console.log("Todas as configurações:", settings);
          console.log("Configurações de som:", settings.soundEffects);
          console.log("Caminho do som incompleto original:", settings.soundEffects.incomplete);
          
          const filename = getFilenameFromPath(settings.soundEffects.incomplete);
          const audioUrl = `http://localhost:3001/sounds/${filename}`;
          console.log("Nome do arquivo limpo:", filename);
          console.log("URL final do áudio:", audioUrl);
          
          // Tentar fazer uma requisição fetch primeiro para verificar se o arquivo existe
          fetch(audioUrl)
            .then(response => {
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              console.log("Arquivo de áudio encontrado no servidor");
              
              const audio = new Audio(audioUrl);
              
              audio.onerror = (e) => {
                console.error("Erro ao carregar áudio:", e);
                console.error("Código do erro:", (audio as any).error?.code);
                console.error("Mensagem do erro:", (audio as any).error?.message);
              };
              
              audio.oncanplay = () => {
                console.log("Áudio pronto para tocar");
              };
              
              return audio.play();
            })
            .catch(error => {
              console.error("Erro ao verificar/tocar o arquivo de áudio:", error);
            });
            
        } catch (error) {
          console.error("Erro ao tocar áudio de performance incompleta:", error);
        }
      } else {
        console.log("Nenhum som de performance incompleta configurado");
      }
      
      // Voltar para a página inicial após 6 segundos
      setTimeout(() => {
        navigate('/');
      }, 6000);
      
      return;
    }

    // Se passou do tempo mínimo, gerar pontuação
    handleSongEnd();
  };

  // Adicionar handler para tecla E
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if ((event.key === 'e' || event.key === 'E') && !showScore && !isAnimatingScore) {
        handleStopPerformance();
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    return () => {
      window.removeEventListener('keypress', handleKeyPress);
    };
  }, [showScore, isAnimatingScore]);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Vídeo ou Simulação de vídeo */}
      {!showScore && !isAnimatingScore ? (
        <div className="relative flex-1 flex items-stretch justify-center bg-karaoke-dark">
          {videoUrl ? (
            <>
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                autoPlay
                className="absolute inset-0 h-full w-full object-fill"
                onPlay={handleVideoStart}
                onEnded={handleSongEnd}
              />
              {/* Botão de Interrupção */}
              <Button
                onClick={handleStopPerformance}
                className="absolute top-4 left-4 z-10 bg-red-600 hover:bg-red-700 text-white text-sm px-3 py-1 h-8"
                size="sm"
              >
                Encerrar (E)
              </Button>
            </>
          ) : (
            <div className="text-white text-2xl">
              {song ? (
                <div className="animate-pulse">
                  Reproduzindo: {song.title} - {song.artist}
                </div>
              ) : (
                <div>Carregando vídeo...</div>
              )}
            </div>
          )}
          
          {/* Container para a fila */}
          <div className="absolute top-4 right-4 w-64">
            {/* Fila de Espera - Limitada a 5 músicas */}
            <SongQueue queue={queue.slice(0, 5)} compact hidePlayButton />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gradient-karaoke">
          <div className="text-center">
            {isAnimatingScore ? (
              <div className="text-9xl font-bold text-white animate-pulse">
                {displayedScore}
              </div>
            ) : (
              <>
                {isPerformanceIncomplete ? (
                  <div className="space-y-6">
                    <div className="text-3xl font-bold text-white">
                      Ops! Performance muito curta
                    </div>
                    <div className="text-xl text-white/80">
                      Você não cantou o suficiente para nossos algoritmos analisarem sua performance.
                      <br />
                      Tente cantar por pelo menos 1 minuto!
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-9xl font-bold animate-score-reveal text-white">
                      {displayedScore}
                    </div>
                    <div className="mt-8 text-2xl font-semibold text-white">
                      {score >= 90 
                        ? "🎉 Incrível! Você arrasou! 🎉" 
                        : score >= 75 
                          ? "🎵 Ótima performance! 🎵" 
                          : "👏 Boa tentativa! 👏"
                      }
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlaySong;
