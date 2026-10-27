// Almacenamiento de imágenes: Amazon S3 en AWS o una carpeta (volumen de Docker) en local.
import fs from 'node:fs';
import path from 'node:path';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const CLAVE_VALIDA = /^media\/[a-z0-9][a-z0-9._/-]*$/i;

function validarClave(clave) {
  if (!CLAVE_VALIDA.test(clave) || clave.includes('..')) throw new Error('clave de imagen inválida');
}

export function crearAlmacen() {
  if ((process.env.STORAGE_MODE || 'local') === 's3') {
    const s3 = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}),
    });
    const bucket = process.env.MEDIA_BUCKET;
    return {
      async guardar(clave, cuerpo, tipo) {
        validarClave(clave);
        await s3.send(new PutObjectCommand({
          Bucket: bucket, Key: clave, Body: cuerpo, ContentType: tipo, CacheControl: 'public, max-age=86400',
        }));
      },
      async leer(clave) {
        validarClave(clave);
        try {
          const r = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: clave }));
          return { cuerpo: r.Body, tipo: r.ContentType };
        } catch (e) {
          if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) return null;
          throw e;
        }
      },
    };
  }

  const raiz = process.env.MEDIA_DIR || '/data/media';
  return {
    async guardar(clave, cuerpo) {
      validarClave(clave);
      const destino = path.join(raiz, clave);
      await fs.promises.mkdir(path.dirname(destino), { recursive: true });
      await fs.promises.writeFile(destino, cuerpo);
    },
    async leer(clave) {
      validarClave(clave);
      const origen = path.join(raiz, clave);
      if (!fs.existsSync(origen)) return null;
      const tipos = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
      return { cuerpo: fs.createReadStream(origen), tipo: tipos[path.extname(origen)] };
    },
  };
}
