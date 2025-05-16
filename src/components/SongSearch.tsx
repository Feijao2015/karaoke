import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { getSongs } from '@/services/dataService';
import { Song } from '@/types/song';
import { Search } from 'lucide-react';

interface SongSearchProps {
  onSongSelect: (song: Song) => void;
}

const SongSearch: React.FC<SongSearchProps> = ({ onSongSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [songs, setSongs] = useState<Song[]>([]);
  const [filteredSongs, setFilteredSongs] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);

  useEffect(() => {
    const fetchSongs = async () => {
      try {
        const songsData = await getSongs();
        setSongs(songsData);
        setIsLoading(false);
      } catch (error) {
        console.error("Erro ao buscar músicas:", error);
        setIsLoading(false);
      }
    };

    fetchSongs();
  }, []);

  useEffect(() => {
    // Filter songs based on search term
    if (!searchTerm.trim()) {
      setFilteredSongs([]);
      setSelectedSong(null); // Clear selected song when search is cleared
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = songs.filter(
      (song) =>
        song.title.toLowerCase().includes(term) ||
        song.artist.toLowerCase().includes(term) ||
        song.number.includes(term)
    );

    // Limit to first 10 results
    setFilteredSongs(filtered.slice(0, 20));
  }, [searchTerm, songs]);

  const handleSongClick = (song: Song) => {
    setSelectedSong(song);
    onSongSelect(song);
    // Não limpar o campo de busca para manter a informação visível
    setFilteredSongs([]);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        <Input
          type="search"
          placeholder="Buscar por número, título ou artista..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-white/90 border-karaoke-primary focus:border-karaoke-secondary focus-visible:ring-karaoke-light py-6 text-lg"
        />
      </div>

      {isLoading && searchTerm && (
        <div className="absolute w-full bg-white mt-1 rounded-md shadow-lg z-10 p-2">
          <div className="animate-pulse flex items-center justify-center p-4">
            <p className="text-gray-500">Carregando...</p>
          </div>
        </div>
      )}

      {!isLoading && filteredSongs.length > 0 && (
        <div className="absolute w-full bg-white mt-1 rounded-md shadow-lg z-10 max-h-72 overflow-y-auto">
          <ul className="py-1">
            {filteredSongs.map((song) => (
              <li
                key={song.id}
                className="px-4 py-3 hover:bg-gray-100 cursor-pointer"
                onClick={() => handleSongClick(song)}
              >
                <div className="flex items-center">
                  <div className="bg-karaoke-primary text-white rounded px-2 py-1 text-xs mr-2">
                    {song.number}
                  </div>
                  <div>
                    <p className="font-medium">{song.title}</p>
                    <p className="text-sm text-gray-600">{song.artist}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isLoading && searchTerm && filteredSongs.length === 0 && !selectedSong && (
        <div className="absolute w-full bg-white mt-1 rounded-md shadow-lg z-10 p-4 text-center">
          <p className="text-gray-500">Nenhuma música encontrada</p>
        </div>
      )}

      {selectedSong && searchTerm && (
        <div className="mt-3 p-4 bg-white rounded-md border border-gray-200">
          <div className="flex items-center">
            <div className="bg-karaoke-primary text-white rounded px-2 py-1 text-sm mr-2">
              {selectedSong.number}
            </div>
            <div className="flex-1">
              <p className="font-medium">{selectedSong.title}</p>
              <p className="text-sm text-gray-600">{selectedSong.artist}</p>
              
              {/* Adicionando exibição da letra inicial */}
              {selectedSong.lyrics && (
                <div className="mt-2 p-2 bg-white rounded border border-white italic text-sm">
                  <p className="text-gray-700">{selectedSong.lyrics}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SongSearch;
