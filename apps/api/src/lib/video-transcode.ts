import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

// O navegador grava a chamada em WebM (VP8/Opus) — o HubSpot não reconhece esse
// formato como vídeo nos anexos. Converte pra MP4 (H.264/AAC), formato universal,
// usando o binário estático do ffmpeg (sem depender de nada instalado no servidor).
export async function transcodeWebmToMp4(buffer: Buffer): Promise<Buffer> {
  const tmpDir = os.tmpdir();
  const id = crypto.randomUUID();
  const inputPath = path.join(tmpDir, `${id}.webm`);
  const outputPath = path.join(tmpDir, `${id}.mp4`);

  await fs.writeFile(inputPath, buffer);

  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions(["-c:v libx264", "-preset ultrafast", "-crf 26", "-c:a aac", "-movflags +faststart"])
        .toFormat("mp4")
        .on("end", () => resolve())
        .on("error", reject)
        .save(outputPath);
    });
    return await fs.readFile(outputPath);
  } finally {
    await fs.rm(inputPath, { force: true });
    await fs.rm(outputPath, { force: true });
  }
}
