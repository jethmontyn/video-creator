import express from 'express';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import axios from 'axios';
import path from 'path';

const app = express();
app.use(express.json({ limit: '50mb' }));

app.get('/', (req, res) => res.send('Railway Video Server OK ✅'));

app.post('/create-video', async (req, res) => {
    const { images } = req.body;
    const timestamp = Date.now();
    const workDir = '/tmp'; 
    const finalVideo = path.join(workDir, `video_${timestamp}.mp4`);
    const downloadedFiles = [];

    try {
        console.log('--- START ---');
        for (let i = 0; i < images.length; i++) {
            const response = await axios({ url: images[i], responseType: 'arraybuffer' });
            const imgPath = path.join(workDir, `img_${i}.jpg`);
            fs.writeFileSync(imgPath, response.data);
            downloadedFiles.push(imgPath);
        }

        ffmpeg()
            .input(path.join(workDir, 'img_%d.jpg'))
            .inputOptions(['-framerate 1/5', '-start_number 0'])
            .outputOptions([
                '-c:v libx264',
                '-pix_fmt yuv420p',
                '-preset superfast',
                '-vf scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',
                '-movflags +faststart'
            ])
            .on('error', (err) => {
                console.error(err);
                if (!res.headersSent) res.status(500).send(err.message);
            })
            .on('end', () => {
                res.download(finalVideo, () => {
                    downloadedFiles.forEach(f => fs.existsSync(f) && fs.unlinkSync(f));
                    if (fs.existsSync(finalVideo)) fs.unlinkSync(finalVideo);
                });
            })
            .save(finalVideo);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Running on ${PORT}`));
