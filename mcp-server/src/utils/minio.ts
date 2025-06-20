import { Client } from 'minio';
import dotenv from 'dotenv';
import { Readable } from 'stream';

dotenv.config();

const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
});

export const ensureBucket = async (bucket: string) => {
  const exists = await minioClient.bucketExists(bucket);
  if (!exists) {
    await minioClient.makeBucket(bucket, 'us-east-1');
  }
};

export const uploadFile = async (
  bucket: string,
  objectName: string,
  data: Buffer | Readable,
  contentType = 'application/octet-stream'
) => {
  await ensureBucket(bucket);
  return minioClient.putObject(bucket, objectName, data, undefined, { 'Content-Type': contentType });
};

export const getPresignedUrl = async (bucket: string, objectName: string, expirySeconds = 3600) => {
  await ensureBucket(bucket);
  return minioClient.presignedGetObject(bucket, objectName, expirySeconds);
};

export default minioClient; 