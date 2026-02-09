import express from 'express';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(express.json({ limit: '50mb' }));

// Базовая проверка, что сервер живой
app.get('/', (req, res) => res.send('Video Server is Online ✅'));

app.post('/create-video', async (req, res) => {
    console.log('--- НОВЫЙ ЗАПРОС НА ВИДЕО ---');
    const { images } = req.body;
    const workDir = '/tmp'; 
    const timestamp = Date.now();
    const finalVideo = path.join(workDir, `output_${timestamp}.mp4`);
    const downloadedFiles = [];

    if (!images || !Array.isArray(images)) {
        return res.status(400).send('Ошибка: Список картинок пуст');
    }

    try {
        // Очистка старых файлов в папке /tmp
        const files = fs.readdirSync(workDir);
        files.forEach(file => {
            if (file.startsWith('img_')) {
                try { fs.unlinkSync(path.join(workDir, file)); } catch (e) {}
            }
        });

        // 1. Скачивание картинок
        for (let i = 0; i < images.length; i++) {
            console.log(`📥 Скачиваю: ${images[i]}`);
            const response = await axios({ 
                url: images[i], 
                responseType: 'arraybuffer',
                timeout: 20000 
            });
            const imgPath = path.join(workDir, `img_${i}.jpg`);
            fs.writeFileSync(imgPath, response.data);
            downloadedFiles.push(imgPath);
        }
        console.log(`✅ Картинки скачаны: ${downloadedFiles.length}`);

        // 2. Рендеринг видео через FFmpeg
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
            .on('start', (cmd) => console.log('🚀 Команда запущена:', cmd))
            .on('error', (err) => {
                console.error('❌ Ошибка FFmpeg:', err.message);
                if (!res.headersSent) res.status(500).send(`FFmpeg Error: ${err.message}`);
            })
            .on('end', () => {
                console.log('🎉 Видео готово! Отправляю...');
                res.download(finalVideo, (err) => {
                    if (err) console.error('❌ Ошибка отправки:', err);
                    
                    // Чистка временных файлов
                    downloadedFiles.forEach(f => {
                        if (fs.existsSync(f)) fs.unlinkSync(f);
                    });
                    if (fs.existsSync(finalVideo)) fs.unlinkSync(finalVideo);
                    console.log('🚮 Память очищена');
                });
            })
            .save(finalVideo);

    } catch (e) {
        console.error('💥 Критическая ошибка:', e.message);
        if (!res.headersSent) res.status(500).send(`Server Error: ${e.message}`);
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Сервер работает на порту ${PORT}`);
});
