import express from 'express';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => res.send('Railway Video Server OK ✅'));

app.post('/create-video', async (req, res) => {
    console.log('--- ПОЛУЧЕН НОВЫЙ ЗАПРОС ---');
    const { images } = req.body;
    const workDir = '/tmp'; 
    const timestamp = Date.now();
    const finalVideo = path.join(workDir, `output_${timestamp}.mp4`);
    const downloadedFiles = [];

    try {
        // ОЧИСТКА: Удаляем старые img_ файлы, если они завалялись
        const files = fs.readdirSync(workDir);
        files.forEach(file => {
            if (file.startsWith('img_')) fs.unlinkSync(path.join(workDir, file));
        });
        console.log('🧹 Папка /tmp очищена');

        // 1. СКАЧИВАНИЕ
        for (let i = 0; i < images.length; i++) {
            console.log(`📥 Скачиваю картинку ${i}...`);
            const response = await axios({ 
                url: images[i], 
                responseType: 'arraybuffer',
                timeout: 15000 
            });
            const imgPath = path.join(workDir, `img_${i}.jpg`);
            fs.writeFileSync(imgPath, response.data);
            downloadedFiles.push(imgPath);
        }
        console.log(`✅ Скачано картинок: ${downloadedFiles.length}`);

        // 2. РЕНДЕР
        console.log('🎬 Запускаю FFmpeg...');
        ffmpeg()
            .input(path.join(workDir, 'img_%d.jpg'))
            .inputOptions(['-framerate 1/5', '-start_number 0'])
            .outputOptions([
                '-c:v libx264',
                '-pix_fmt yuv420p',
                '-preset ultrafast',
                '-vf scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',
                '-movflags +faststart'
            ])
            .on('start', (cmd) => console.log('🚀 Команда FFmpeg:', cmd))
            .on('error', (err) => {
                console.error('❌ Ошибка FFmpeg:', err.message);
                if (!res.headersSent) res.status(500).send(`FFmpeg Error: ${err.message}`);
            })
            .on('end', () => {
                console.log('🎉 Видео готово! Отправляю...');
                res.download(finalVideo, () => {
                    // Чистка после отправки
                    downloadedFiles.forEach(f => fs.existsSync(f) && fs.unlinkSync(f));
                    if (fs.existsSync(finalVideo)) fs.unlinkSync(finalVideo);
                    console.log('🚮 Временные файлы удалены');
                });
            })
            .save(finalVideo);

    } catch (e) {
        console.error('💥 Критическая ошибка:', e.message);
        if (!res.headersSent) res.status(500).send(`Server Error: ${e.message}`);
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
