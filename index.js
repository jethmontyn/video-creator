import express from 'express';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => res.send('SERVER IS LIVE ✅'));

app.post('/create-video', async (req, res) => {
    console.log('--- ЗАПРОС ПОЛУЧЕН ---');
    const { images } = req.body;
    const workDir = '/tmp'; 
    const finalVideo = path.join(workDir, `video_${Date.now()}.mp4`);
    const downloadedFiles = [];

    try {
        // 1. Скачивание картинок
        for (let i = 0; i < images.length; i++) {
            const response = await axios({ url: images[i], responseType: 'arraybuffer' });
            const imgPath = path.join(workDir, `img_${i}.jpg`);
            fs.writeFileSync(imgPath, response.data);
            downloadedFiles.push(imgPath);
        }
        console.log('✅ Картинки скачаны');

        // 2. Сборка видео
        ffmpeg()
            .input(path.join(workDir, 'img_%d.jpg'))
            .inputOptions(['-framerate 1/5', '-start_number 0'])
            .outputOptions(['-c:v libx264', '-pix_fmt yuv420p', '-preset ultrafast'])
            .on('error', (err) => {
                console.error('❌ Ошибка FFmpeg:', err.message);
                res.status(500).send(err.message);
            })
            .on('end', () => {
                console.log('🎉 Готово, отправляю!');
                res.download(finalVideo, () => {
                    downloadedFiles.forEach(f => fs.existsSync(f) && fs.unlinkSync(f));
                    if (fs.existsSync(finalVideo)) fs.unlinkSync(finalVideo);
                });
            })
            .save(finalVideo);

    } catch (e) {
        console.error('💥 Ошибка сервера:', e.message);
        res.status(500).send(e.message);
    }
});

app.listen(process.env.PORT || 8080, '0.0.0.0', () => {
    console.log('🚀 СЕРВЕР ЗАПУЩЕН');
});
