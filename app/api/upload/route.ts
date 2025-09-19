// app/api/upload/route.ts
import { NextResponse } from 'next/server';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client } from '@/app/lib/s3';
// import s3Client from '@/app/lib/s3';



export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body?.url) {
      return NextResponse.json({ error: "URL عکس الزامی است" }, { status: 400 });
    }

    // دانلود فایل از URL (فایل تلگرام)
    const response = await fetch(body.url);
    if (!response.ok) throw new Error("دانلود عکس از تلگرام ناموفق بود");


    const buffer = Buffer.from(await response.arrayBuffer());
    // هدر Content-Type رو بخون

    let contentType = response.headers.get('content-type') || 'image/jpeg';
    // فقط بخش image/* رو نگه دار
    if (!contentType.startsWith("image/")) {
      contentType = "image/jpeg"; // fallback
    }
    // پسوند معتبر بساز
    let extension = contentType.split("/")[1] || "jpg";
    if (extension === "jpeg") extension = "jpg"; // normalize

    const key = `uploads/telegram/${Date.now()}.${extension}`;

    // پارامترهای آپلود
    const params = {
      Bucket: process.env.LIARA_BUCKET_NAME ?? 'c589564',
      Key: key,
      Body: buffer,
      ContentType: contentType,
    };

    // آپلود به پارس‌پک
    const up = await s3Client.send(new PutObjectCommand(params));
    console.log(up, 'up')
    // let typefile = ''
    // const searchChar = params.ContentType.search('/')

    // typefile = params.ContentType.slice(searchChar +1)




    // تولید لینک عمومی
    const publicUrl = `${process.env.LIARA_ENDPOINT!}/${process.env.LIARA_BUCKET_NAME!}/${key}`

    return NextResponse.json({
      success: true,
      url: publicUrl,
      Key: key
    });

  } catch (error) {
    console.error('خطا در آپلود:', error);
    return NextResponse.json(
      { error: 'خطا در آپلود فایل' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { key } = await req.json();
    console.log('کلید برای حذف:', key);

    // اعتبارسنجی کلید
    if (!key || typeof key !== 'string') {
      return NextResponse.json(
        { error: 'کلید فایل نامعتبر است' },
        { status: 400 }
      );
    }

    // پارامترهای حذف
    const params = {
      Bucket: process.env.LIARA_BUCKET_NAME ?? 'c589564',
      Key: key,
    };

    console.log(params, 'prarsms')
    // حذف فایل از پارس‌پک
    await s3Client.send(new DeleteObjectCommand(params));

    return NextResponse.json({
      success: true,
      message: `فایل با کلید ${key} با موفقیت حذف شد`,
    });
  } catch (error) {
    console.error('خطا در حذف فایل:', error);
    return NextResponse.json(
      { error: 'خطا در حذف فایل' },
      { status: 500 }
    );
  }
}