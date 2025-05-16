import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3001; // Porta diferente do frontend

// Habilitar CORS para o frontend acessar
app.use(cors());
app.use(express.json());

// Configurar cliente Supabase
const supabase = createClient(
    "https://drufkqjxtgexpbwkwbti.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRydWZrcWp4dGdleHBid2t3YnRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc0MDI2NjYsImV4cCI6MjA2Mjk3ODY2Nn0.hVfbdcNO5OeSZ6lCR4_jbRjzwg-_Og1ghMBVh-IzFhU"
);

// Função para obter o caminho dos vídeos das configurações
async function getVideosPath() {
    try {
        const { data, error } = await supabase
            .from('settings')
            .select('videos_path')
            .maybeSingle();

        if (error) throw error;
        return data?.videos_path || 'D:/KARAOKEV3/musicas'; // Caminho padrão como fallback
    } catch (error) {
        console.error('Erro ao buscar caminho dos vídeos:', error);
        return 'D:/KARAOKEV3/musicas'; // Caminho padrão em caso de erro
    }
}

// Função para obter o caminho dos sons das configurações
async function getSoundsPath() {
    try {
        // Usar diretamente o diretório de áudio configurado
        return 'D:/KARAOKEV3/audio'; // Diretório fixo onde os arquivos de som estão armazenados
    } catch (error) {
        console.error('Erro ao buscar caminho dos sons:', error);
        return 'D:/KARAOKEV3/audio'; // Caminho padrão em caso de erro
    }
}

// Rota para servir os vídeos com suporte a streaming
app.get('/videos/:filename', async (req, res) => {
    const filename = req.params.filename;
    const videosPath = await getVideosPath();
    const videoPath = path.join(videosPath, filename);

    console.log('Requisição de vídeo recebida:');
    console.log('Nome do arquivo:', filename);
    console.log('Caminho do diretório de vídeos:', videosPath);
    console.log('Caminho completo do arquivo:', videoPath);

    // Verificar se o arquivo existe
    if (!fs.existsSync(videoPath)) {
        console.log('Arquivo não encontrado:', videoPath);
        return res.status(404).send('Arquivo de vídeo não encontrado');
    }

    // Obter o tamanho do arquivo
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
        // Parsing do header range
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(videoPath, { start, end });
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'video/mp4',
        };
        res.writeHead(206, head);
        file.pipe(res);
    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4',
        };
        res.writeHead(200, head);
        fs.createReadStream(videoPath).pipe(res);
    }
});

// Rota para servir os arquivos de som
app.get('/sounds/:filename', async (req, res) => {
    const filename = req.params.filename;
    const soundsPath = await getSoundsPath();
    const soundPath = path.join(soundsPath, filename);

    console.log('Requisição de som recebida:');
    console.log('Nome do arquivo:', filename);
    console.log('Caminho do diretório de sons:', soundsPath);
    console.log('Caminho completo do arquivo:', soundPath);

    // Verificar se o arquivo existe
    if (!fs.existsSync(soundPath)) {
        console.log('Arquivo não encontrado:', soundPath);
        return res.status(404).send('Arquivo de som não encontrado');
    }

    console.log('Arquivo encontrado, verificando extensão...');

    // Verificar a extensão do arquivo
    const ext = path.extname(soundPath).toLowerCase();
    const allowedExtensions = ['.mp3', '.wav', '.ogg'];
    
    if (!allowedExtensions.includes(ext)) {
        console.log('Extensão não permitida:', ext);
        return res.status(400).send('Tipo de arquivo não permitido');
    }

    console.log('Extensão válida:', ext);

    // Configurar o tipo MIME correto
    const mimeTypes = {
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg'
    };

    res.setHeader('Content-Type', mimeTypes[ext]);
    console.log('Iniciando stream do arquivo...');
    fs.createReadStream(soundPath).pipe(res);
});

// Rota de teste
app.get('/test', (req, res) => {
    res.json({ message: 'Servidor funcionando!' });
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
}); 