// lib/s3.ts

import { S3Client, DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';





const s3Client = new S3Client({
  region: process.env.LIARA_REGION,
  endpoint: process.env.LIARA_ENDPOINT!,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.LIARA_ACCESS_KEY!,
    secretAccessKey: process.env.LIARA_SECRET_KEY!,
  },
});


export { s3Client, DeleteObjectCommand, PutObjectCommand };