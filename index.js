import express from 'express';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static'; // Добавляем эту строку
import fs from 'fs';
import axios from 'axios';
import path from 'path';
import { exec } from 'child_process';

// Указываем путь к ffmpeg явно
ffmpeg.setFfmpegPath(ffmpegPath); 

const app = express();
app.use(express.json({ limit: '50mb' }));

// Проверка: есть ли ffmpeg в системе?
exec('ffmpeg -version', (err, stdout) => {
    if (err) console.error('❌ FFmpeg NOT FOUND in system!');
    else console.log('✅ FFmpeg is ready!');
});

app.get('/', (req, res) => res.send('Railway Video Server OK ✅'));

app.post('/create-video', async (req, res) => {
    console.log('--- START ---');
    // ... (остальной код скачивания и рендера остается таким же, как я давал в прошлый раз)
});

// ПОРТ: Railway очень любит 8080 или порт из переменной окружения
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
