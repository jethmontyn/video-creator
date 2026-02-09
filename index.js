import express from 'express';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => res.send('Railway Video Server OK ✅'));

app.post('/create-video', async (req, res) => {
    console.log('--- НОВЫЙ ЗАПРОС ---');
    const { images } = req.body;
    const timestamp = Date.now();
    const workDir = '/tmp'; 
    const finalVideo = path.join(workDir, `video_${timestamp}.mp4`);
    const downloadedFiles = [];

    try {
        // 1. Скачивание с проверкой
        for (let i = 0; i < images.length; i++) {
            console.log(`Скачиваю картинку ${i}: ${images[i].substring(0, 50)}...`);
            const response = await axios({ 
                url: images[i], 
                responseType: 'arraybuffer',
                timeout: 15000 
            });
            const imgPath = path.join(workDir, `img_${i}.jpg`);
            fs.writeFileSync(imgPath, response.data);
            downloadedFiles.push(imgPath);
            console.log(`Сохранена: ${imgPath}`);
        }

        if (downloadedFiles.length === 0) throw new Error('Файлы не скачаны!');

        // 2. Рендер
        console.log('🎬 Запуск FFmpeg...');
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
            .on('start', (cmd) => console.log('Команда FFmpeg:', cmd))
            .on('error', (err) => {
                console.error('Ошибка FFmpeg:', err.message);
                if (!res.headersSent) res.status(500).send(`FFmpeg Error: ${err.message}`);
            })
            .on('end', () => {
                console.log('✅ Видео готово, отправляю...');
                res.download(finalVideo, (err) => {
                    // Чистка после отправки
                    downloadedFiles.forEach(f => fs.existsSync(f) && fs.unlinkSync(f));
                    if (fs.existsSync(finalVideo)) fs.unlinkSync(finalVideo);
                });
            })
            .save(finalVideo);

    } catch (e) {
        console.error('Общая ошибка:', e.message);
        if (!res.headersSent) res.status(500).send(`Server Error: ${e.message}`);
        downloadedFiles.forEach(f => fs.existsSync(f) && fs.unlinkSync(f));
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Running on ${PORT}`));
