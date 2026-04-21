import { GoogleGenAI, Type } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Define the handler for standalone Vercel deployment
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return res.status(500).json({ error: "Missing or invalid GEMINI_API_KEY in environment" });
  }

  const ai = new GoogleGenAI({ apiKey });
  const { imageBase64, mimeType, extraContextPrompt, projectsContext } = req.body;

  if (!imageBase64 || !mimeType) {
    return res.status(400).json({ error: 'Missing image data' });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            data: imageBase64,
            mimeType: mimeType,
          }
        },
        `你是一位资深的面相学大师和高级美业顾问。请仔细观察照片中人物的真实面部特征，进行千人千面的玄学面相分析。${extraContextPrompt}
【核心警告】：
1. 严禁虚构特征！必须100%基于照片中真实可见的五官进行分析。如果照片中某部位看不清，请如实说明，绝不能凭空捏造（例如明明是平眉非说是挑眉，明明没有眼袋非说有眼袋）。
2. 严禁千篇一律！严禁频繁使用“漏财”、“守财难”、“破财”等套话！

请按以下步骤进行：
第一步：人脸检测验证。请先判断照片中是否包含清晰完整的真人正面或微侧面脸。如果：
  - 无法识别到人脸
  - 人脸严重模糊、被大面积遮挡
  - 仅有侧脸或背影
  - 不是真人（如卡通、动物、静物、风景等）
  请将 isValidFace 标为 false，并在 invalidReason 中说明原因（如“未检测到人脸”、“图片模糊”、“不是真人”等），其他分析字段留空即可，停止后续分析。
  如果照片包含清晰完整的真人人脸（isValidFace 为 true，invalidReason 设为空），请接着进行后续分析。

第二步：客观特征提取。请先抛开玄学，极其客观、准确地描述你在照片中看到的真实五官特征（脸型、眉毛粗细/走向/浓淡、眼睛大小/形状、鼻子高低/宽窄、嘴唇厚薄等）。
第三步：全面面相分析。基于客观提取的【真实特征】，进行以下维度的解析：
1. 脸型与整体轮廓（如天庭、地阁、脸型格局）
2. 鼻型（财帛宫，如鼻头、鼻翼、山根）
3. 眉眼特征（如眉形、眉眼间距、眼神）

基于照片中真实的特征，指出其面相中的优势（如事业运旺、贵人运好、桃花旺等），以及目前存在的一处真实可见的瑕疵（如眉毛杂乱、眉尾下垂、唇色暗淡、面部凹陷、眼神无光等）。

【运势痛点要求】：
在分析瑕疵带来的运势阻碍时，请强制从以下维度中选择最贴切的一个，不要总是扯到钱财上：
- 事业运：晋升受阻、遭遇职场小人、决断力不足、容易错失良机、缺乏权威感。
- 感情运：烂桃花多、正缘迟迟不来、感情容易患得患失、夫妻/伴侣沟通不畅。
- 人际运：容易招惹口舌是非、贵人运欠佳、给人距离感、缺乏亲和力、容易被误解。
- 情绪/状态：容易精神内耗、思虑过重、缺乏自信、近期容易感到疲惫。

最后，针对这个瑕疵，你必须从以下我们美容院提供的项目中，智能推荐1到2个最适合的项目来'改运'：
${projectsContext}

你必须在 recommendedProjects 字段中明确列出推荐的项目名称（必须与列表中的名称完全一致）。
在 suggestedSolution 字段中详细说明推荐理由和改运效果。

语言要专业、有神秘感、有吸引力，能作为美容师与客户破冰、促单的高级话术。`
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValidFace: { type: Type.BOOLEAN, description: "照片中是否包含清晰完整的真人人脸。" },
            invalidReason: { type: Type.STRING, description: "如果不包含，说明原因（如：未识别到人脸、图片模糊等）。如果包含则留空。" },
            objectiveFeatures: { type: Type.STRING, description: "客观描述照片中人物的真实五官特征（脸型、眉眼、鼻子、嘴唇等），不带任何玄学色彩，证明你确实看清了照片。" },
            fortuneSummary: { type: Type.STRING, description: "一句话面相总结，结合照片真实特征，点出核心运势格局 (例如: 木型脸配水波眼，主贵人运旺，但眉尾散乱略欠临门一脚)" },
            facialAnalysis: { type: Type.STRING, description: "综合面相分析，必须包含对照片中真实脸型、鼻型（财帛宫）、三庭五眼的具体点评" },
            eyebrowAnalysis: { type: Type.STRING, description: "眉眼特征具体分析，基于照片中真实的眉形、浓密、走向进行玄学解读" },
            luckIssue: { type: Type.STRING, description: "基于瑕疵推导的具体运势痛点。严禁写'漏财/守财难'，必须从事业受阻、烂桃花、口舌是非、精神内耗、缺乏亲和力等非金钱维度进行深度解析。" },
            recommendedProjects: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING }, 
              description: "明确推荐的项目名称列表（必须完全匹配提供的项目名称）" 
            },
            suggestedSolution: { type: Type.STRING, description: "详细说明推荐理由和改运效果" },
            beauticianPitch: { type: Type.STRING, description: "美容师破冰话术，结合上述真实面相优点和瑕疵，自然切入推销你推荐的那个项目" }
          },
          required: ["isValidFace", "invalidReason", "objectiveFeatures", "fortuneSummary", "facialAnalysis", "eyebrowAnalysis", "luckIssue", "recommendedProjects", "suggestedSolution", "beauticianPitch"]
        }
      }
    });
    
    // We expect the JSON string directly from response.text
    res.status(200).json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    console.error("Generate API Error:", error);
    res.status(500).json({ error: error.message || "内部解析失败" });
  }
}
