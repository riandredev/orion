import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const folder = searchParams.get('folder');

  console.log('API Route called with folder:', folder);

  if (!folder) {
    console.error('Invalid folder parameter');
    return NextResponse.json({ error: 'Invalid folder parameter' }, { status: 400 });
  }

  const folderPath = path.join(process.cwd(), 'public', folder);
  console.log('Attempting to read folder:', folderPath);

  try {
    const files = await fs.promises.readdir(folderPath);
    console.log('Files found:', files);
    const images = files
      .filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file))
      .map(file => `/${folder}/${file}`);
    console.log('Filtered images:', images);
    return NextResponse.json(images, { status: 200 });
  } catch (error: unknown) {
    console.error('Error reading folder:', error);
    return NextResponse.json({ error: 'Error reading folder', details: (error as Error).message }, { status: 500 });
  }
}

