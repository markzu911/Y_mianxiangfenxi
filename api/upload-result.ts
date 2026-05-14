import type { VercelRequest, VercelResponse } from '@vercel/node';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const userId = req.query.userId as string;
    const toolId = req.query.toolId as string;
    
    if (!userId || !toolId) {
      return res.status(400).json({ success: false, error: 'Missing userId or toolId in query' });
    }

    const chunks = [];
    for await (const chunk of req as any) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const imageBuffer = Buffer.concat(chunks);
    
    if (imageBuffer.length === 0) {
      return res.status(400).json({ success: false, error: 'Request body must be binary image data' });
    }

    const SAAS_ORIGIN = process.env.SAAS_ORIGIN || 'https://aibigtree.com';
    const axios = (await import('axios')).default;
    
    // 1. direct-token
    const tokenRes = await axios.post(`${SAAS_ORIGIN}/api/upload/direct-token`, {
      userId,
      toolId,
      source: 'result',
      mimeType: 'image/jpeg',
      fileName: 'report.jpg',
      fileSize: imageBuffer.byteLength
    });
    
    const token = tokenRes.data;
    if (!token || !token.success) {
       throw new Error(token?.error || "获取 token 失败");
    }

    // 2. PUT to OSS
    const uploadRes = await fetch(token.uploadUrl, {
      method: token.method || 'PUT',
      headers: token.headers,
      body: imageBuffer
    });
    
    if (!uploadRes.ok) {
       throw new Error(`OSS 上传失败: ${uploadRes.status}`);
    }

    // 3. commit
    const commitRes = await axios.post(`${SAAS_ORIGIN}/api/upload/commit`, {
      userId,
      toolId,
      source: 'result',
      objectKey: token.objectKey,
      fileSize: imageBuffer.byteLength
    });

    const commit = commitRes.data;
    if (!commit.success || !commit.savedToRecords) {
      throw new Error(commit.error || '图片入库失败');
    }

    res.json({ success: true, image: commit.image || commit.recordId });
  } catch (error: any) {
    console.error("Upload Result Error:", error.response?.data || error.message);
    res.status(500).json({ success: false, error: error.message || "上传失败" });
  }
}
