import { supabase } from '@/integrations/supabase/client';
import { Song, QueueItem, RankingItem, AppSettings } from '@/types/song';

// Re-export the AppSettings type
export type { AppSettings };

// Função para buscar todas as músicas
export const getSongs = async (): Promise<Song[]> => {
  try {
    // Primeiro, tentamos obter do localStorage para economizar chamadas a API
    const cachedSongs = localStorage.getItem('cachedSongs');
    const cacheTimestamp = localStorage.getItem('songsCacheTimestamp');
    const currentTime = new Date().getTime();
    
    // Se temos dados em cache e eles são de menos de 1 hora atrás, use-os
    if (cachedSongs && cacheTimestamp && 
        (currentTime - parseInt(cacheTimestamp)) < 3600000) {
      return JSON.parse(cachedSongs) as Song[];
    }
    
    // Caso contrário, busque do Supabase - com paginação para lidar com grandes conjuntos
    let allSongs: Song[] = [];
    let hasMore = true;
    let page = 0;
    const pageSize = 1000; // Buscar 1000 músicas por vez
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1)
        .order('number', { ascending: true });
        
      if (error) {
        console.error('Erro ao buscar músicas:', error);
        throw error;
      }
      
      if (data && data.length > 0) {
        allSongs = [...allSongs, ...data];
        page++;
        
        // Se buscamos menos que o tamanho da página, não há mais dados
        if (data.length < pageSize) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }
    
    // Armazene em cache para uso futuro
    localStorage.setItem('cachedSongs', JSON.stringify(allSongs));
    localStorage.setItem('songsCacheTimestamp', currentTime.toString());
    
    return allSongs;
  } catch (error) {
    console.error('Erro ao buscar músicas:', error);
    
    // Tente usar cache mesmo se for antigo em caso de erro
    const cachedSongs = localStorage.getItem('cachedSongs');
    if (cachedSongs) {
      return JSON.parse(cachedSongs) as Song[];
    }
    
    return []; // Retorna array vazio se tudo falhar
  }
};

// Função para adicionar uma música
export const addSong = async (song: Omit<Song, 'id'>): Promise<Song | null> => {
  try {
    const { data, error } = await supabase
      .from('songs')
      .insert([song])
      .select()
      .single();

    if (error) {
      console.error('Erro ao adicionar música:', error.message);
      return null;
    }

    // Limpar o cache para forçar a atualização na próxima busca
    localStorage.removeItem('cachedSongs');
    
    return data as Song;
  } catch (error) {
    console.error('Erro ao adicionar música:', error);
    return null;
  }
};

// Função para atualizar uma música
export const updateSong = async (song: Song): Promise<Song | null> => {
  try {
    const { data, error } = await supabase
      .from('songs')
      .update(song)
      .eq('id', song.id)
      .select()
      .single();

    if (error) {
      console.error('Erro ao atualizar música:', error.message);
      return null;
    }

    // Limpar o cache para forçar a atualização na próxima busca
    localStorage.removeItem('cachedSongs');

    return data as Song;
  } catch (error) {
    console.error('Erro ao atualizar música:', error);
    return null;
  }
};

// Função para deletar uma música
export const deleteSong = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('songs')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao deletar música:', error.message);
      return false;
    }

    // Limpar o cache para forçar a atualização na próxima busca
    localStorage.removeItem('cachedSongs');

    return true;
  } catch (error) {
    console.error('Erro ao deletar música:', error);
    return false;
  }
};

// Função para buscar uma música pelo número
export const getSongByNumber = async (number: string): Promise<Song | null> => {
  try {
    console.log('Buscando música com número:', number);
    console.log('Tipo do número:', typeof number);
    
    // Verificar se o número é um UUID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(number);
    console.log('É UUID?', isUUID);
    
    // Se for UUID, buscar por ID
    if (isUUID) {
      console.log('Buscando por ID em vez de número');
      const { data, error } = await supabase
        .from('songs')
        .select('*')
        .eq('id', number)
        .single();

      if (error) {
        console.error('Erro ao buscar música por ID:', error.message);
        return null;
      }

      return data as Song;
    }

    // Se não for UUID, buscar por número
    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .eq('number', number)
      .single();

    if (error) {
      console.error('Erro ao buscar música por número:', error.message);
      return null;
    }

    return data as Song;
  } catch (error) {
    console.error('Erro ao buscar música por número:', error);
    return null;
  }
};

// Função auxiliar para converter dados da fila do banco para QueueItem
const convertToQueueItem = async (queueRow: any): Promise<QueueItem> => {
  // Buscar dados da música relacionada
  const { data: song, error } = await supabase
    .from('songs')
    .select('*')
    .eq('id', queueRow.song_id)
    .single();

  if (error || !song) {
    throw new Error(`Música com ID ${queueRow.song_id} não encontrada`);
  }
  
  return {
    id: queueRow.id,
    song: song,
    singer: queueRow.singer_name,
    queue_position: queueRow.queue_position,
    created_at: queueRow.created_at
  };
};

// Função para buscar a fila de reprodução
export const getQueue = async (): Promise<QueueItem[]> => {
  try {
    const { data, error } = await supabase
      .from('queue')
      .select('*')
      .order('queue_position', { ascending: true });

    if (error) {
      console.error('Erro ao buscar fila:', error.message);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Converter cada item da fila
    const queuePromises = data.map(item => convertToQueueItem(item));
    return await Promise.all(queuePromises);
  } catch (error) {
    console.error('Erro ao buscar fila:', error);
    return [];
  }
};

// Função para adicionar uma música à fila
export const addToQueue = async (queueItem: { song: Song; singer: string }): Promise<QueueItem | null> => {
  try {
    // Obter a próxima posição na fila
    const { data: queueData } = await supabase
      .from('queue')
      .select('queue_position')
      .order('queue_position', { ascending: false })
      .limit(1);
    
    const nextPosition = queueData && queueData.length > 0 ? queueData[0].queue_position + 1 : 1;
    
    // Inserir na fila
    const { data, error } = await supabase
      .from('queue')
      .insert([{
        song_id: queueItem.song.id,
        singer_name: queueItem.singer,
        queue_position: nextPosition
      }])
      .select()
      .single();

    if (error) {
      console.error('Erro ao adicionar à fila:', error.message);
      return null;
    }

    return await convertToQueueItem(data);
  } catch (error) {
    console.error('Erro ao adicionar à fila:', error);
    return null;
  }
};

// Função para remover uma música da fila
export const removeFromQueue = async (index: number): Promise<boolean> => {
  try {
    // Primeiro, carregue a fila atual para obter o ID do item correto
    const queue = await getQueue();
    if (!queue || queue.length <= index) {
      console.error('Índice inválido para remover da fila.');
      return false;
    }

    const itemToRemove = queue[index];
    if (!itemToRemove.id) {
      console.error('Item da fila não possui ID.');
      return false;
    }
    
    const { error } = await supabase
      .from('queue')
      .delete()
      .eq('id', itemToRemove.id);

    if (error) {
      console.error('Erro ao remover da fila:', error.message);
      return false;
    }

    // Reordenar a fila após a remoção
    await reorderQueue();

    return true;
  } catch (error) {
    console.error('Erro ao remover da fila:', error);
    return false;
  }
};

// Função para limpar toda a fila
export const clearQueue = async (): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('queue')
      .delete()
      .gte('id', '0'); // Deleta todos os registros

    if (error) {
      console.error('Erro ao limpar fila:', error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Erro ao limpar fila:', error);
    return false;
  }
};

// Função para mover um item na fila
export const moveQueueItem = async (fromIndex: number, toIndex: number): Promise<boolean> => {
  try {
    // Buscar a fila atual
    const queue = await getQueue();
    if (!queue || queue.length <= Math.max(fromIndex, toIndex)) {
      console.error('Índices inválidos para mover na fila.');
      return false;
    }

    // Reordenar as posições no banco de dados
    const fromItem = queue[fromIndex];
    const toItem = queue[toIndex];
    
    if (!fromItem.id || !toItem.id) {
      console.error('Itens da fila não possuem ID.');
      return false;
    }

    // Atualizar posição do item origem
    await supabase
      .from('queue')
      .update({ queue_position: toIndex + 1 }) // +1 porque no banco começa em 1, não em 0
      .eq('id', fromItem.id);

    // Atualizar posição do item destino
    await supabase
      .from('queue')
      .update({ queue_position: fromIndex + 1 }) // +1 porque no banco começa em 1, não em 0
      .eq('id', toItem.id);

    // Reordenar toda a fila para garantir consistência
    await reorderQueue();

    return true;
  } catch (error) {
    console.error('Erro ao mover item na fila:', error);
    return false;
  }
};

// Função auxiliar para reordenar a fila
const reorderQueue = async (): Promise<void> => {
  try {
    // Buscar todos os itens ordenados pela posição atual
    const { data, error } = await supabase
      .from('queue')
      .select('*')
      .order('queue_position', { ascending: true });

    if (error || !data) {
      console.error('Erro ao buscar fila para reordenar:', error);
      return;
    }

    // Atualizar as posições em sequência
    for (let i = 0; i < data.length; i++) {
      await supabase
        .from('queue')
        .update({ queue_position: i + 1 })
        .eq('id', data[i].id);
    }
  } catch (error) {
    console.error('Erro ao reordenar fila:', error);
  }
};

// Função auxiliar para converter dados do ranking do banco para RankingItem
const convertToRankingItem = async (rankingRow: any): Promise<RankingItem> => {
  try {
    // Buscar dados da música relacionada
    const song = await getSongByNumber(rankingRow.song_id);
    if (!song) {
      console.warn(`Música com ID ${rankingRow.song_id} não encontrada no ranking, usando dados parciais`);
      // Retornar item do ranking mesmo sem a música completa
      return {
        id: rankingRow.id,
        song: {
          id: rankingRow.song_id,
          number: rankingRow.song_id,
          title: 'Música não encontrada',
          artist: '-',
          lyrics: null
        },
        singer: rankingRow.singer_name,
        score: rankingRow.score,
        date: rankingRow.created_at,
        created_at: rankingRow.created_at
      };
    }
    
    return {
      id: rankingRow.id,
      song: song,
      singer: rankingRow.singer_name,
      score: rankingRow.score,
      date: rankingRow.created_at,
      created_at: rankingRow.created_at
    };
  } catch (error) {
    console.error('Erro ao converter item do ranking:', error);
    throw error;
  }
};

// Função para buscar o ranking
export const getRanking = async (): Promise<RankingItem[]> => {
  try {
    const { data, error } = await supabase
      .from('ranking')
      .select('*')
      .order('score', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Erro ao buscar ranking:', error.message);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Converter cada item do ranking
    const rankingPromises = data.map(item => convertToRankingItem(item));
    return await Promise.all(rankingPromises);
  } catch (error) {
    console.error('Erro ao buscar ranking:', error);
    return [];
  }
};

// Função para adicionar uma pontuação ao ranking
export const addToRanking = async (rankingItem: { song: Song; singer: string; score: number }): Promise<RankingItem | null> => {
  try {
    const { data, error } = await supabase
      .from('ranking')
      .insert([{
        song_id: rankingItem.song.id,
        singer_name: rankingItem.singer,
        score: rankingItem.score
      }])
      .select()
      .single();

    if (error) {
      console.error('Erro ao adicionar ao ranking:', error.message);
      return null;
    }

    return await convertToRankingItem(data);
  } catch (error) {
    console.error('Erro ao adicionar ao ranking:', error);
    return null;
  }
};

// Função para limpar todo o ranking
export const clearRanking = async (): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('ranking')
      .delete()
      .gte('id', '0'); // Deleta todos os registros

    if (error) {
      console.error('Erro ao limpar ranking:', error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Erro ao limpar ranking:', error);
    return false;
  }
};

// Função para gerar uma pontuação aleatória
export const generateScore = (): number => {
  return Math.floor(Math.random() * (100 - 65 + 1)) + 65;
};

// Função para buscar as configurações do app
export const getSettings = async (): Promise<AppSettings | null> => {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar configurações:', error.message);
      return null;
    }

    if (!data) {
      return {
        videosPath: '',
        soundEffects: {},
        adminPassword: 'admin123'
      };
    }

    return {
      id: data.id,
      videosPath: data.videos_path || '',
      backgroundImage: data.background_image,
      soundEffects: {
        low: data.low_score_sound,
        medium: data.medium_score_sound,
        high: data.high_score_sound,
        drums: data.drums_sound,
        incomplete: data.incomplete_sound
      },
      adminPassword: 'admin123', // Default password if not set
      created_at: data.created_at
    };
  } catch (error) {
    console.error('Erro ao buscar configurações:', error);
    return {
      videosPath: '',
      soundEffects: {},
      adminPassword: 'admin123'
    };
  }
};

// Função para atualizar as configurações do app
export const updateSettings = async (settings: AppSettings): Promise<AppSettings | null> => {
  try {
    const dataToUpdate = {
      videos_path: settings.videosPath,
      background_image: settings.backgroundImage,
      low_score_sound: "D:/KARAOKEV3/audio/abaixo de 75.mp3",
      medium_score_sound: "D:/KARAOKEV3/audio/75 a 90.mp3",
      high_score_sound: "D:/KARAOKEV3/audio/acima de 90.mp3",
      drums_sound: "D:/KARAOKEV3/audio/tambores.mp3",
      incomplete_sound: "D:/KARAOKEV3/audio/sem_performance.mp3"
    };

    let result;
    
    // Verificar se já existe um registro de configurações
    const { data: existingSettings } = await supabase
      .from('settings')
      .select('id')
      .limit(1);
      
    if (existingSettings && existingSettings.length > 0) {
      // Atualizar configuração existente
      const { data, error } = await supabase
        .from('settings')
        .update(dataToUpdate)
        .eq('id', existingSettings[0].id)
        .select()
        .single();
        
      if (error) throw error;
      result = data;
    } else {
      // Criar nova configuração
      const { data, error } = await supabase
        .from('settings')
        .insert([dataToUpdate])
        .select()
        .single();
        
      if (error) throw error;
      result = data;
    }

    return {
      id: result.id,
      videosPath: result.videos_path || '',
      backgroundImage: result.background_image,
      soundEffects: {
        low: result.low_score_sound,
        medium: result.medium_score_sound,
        high: result.high_score_sound,
        drums: result.drums_sound,
        incomplete: result.incomplete_sound
      },
      adminPassword: 'admin123', // Default password if not set
      created_at: result.created_at
    };
  } catch (error) {
    console.error('Erro ao atualizar configurações:', error);
    return null;
  }
};
