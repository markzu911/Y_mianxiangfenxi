import { useState, useRef } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Camera, Loader2, RefreshCcw, Sparkles, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toPng } from 'html-to-image';
import { beautyProjects } from './lib/beautyProjects';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface AnalysisResult {
  objectiveFeatures: string;
  fortuneSummary: string;
  facialAnalysis: string;
  eyebrowAnalysis: string;
  luckIssue: string;
  recommendedProjects: string[];
  suggestedSolution: string;
  beauticianPitch: string;
}

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [hidePitchInExport, setHidePitchInExport] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setResult(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeFace = async () => {
    if (!image) return;
    
    setIsAnalyzing(true);
    setError(null);
    
    const projectsContext = beautyProjects.map(p => 
      `- ${p.name} (${p.category}): ${p.description} 【玄学功效: ${p.fengshuiBenefit}】`
    ).join('\n');
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            inlineData: {
              data: image.split(',')[1],
              mimeType: image.split(';')[0].split(':')[1],
            }
          },
          `你是一位资深的面相学大师和高级美业顾问。请仔细观察照片中人物的真实面部特征，进行千人千面的玄学面相分析。
【核心警告】：
1. 严禁虚构特征！必须100%基于照片中真实可见的五官进行分析。如果照片中某部位看不清，请如实说明，绝不能凭空捏造（例如明明是平眉非说是挑眉，明明没有眼袋非说有眼袋）。
2. 严禁千篇一律！严禁频繁使用“漏财”、“守财难”、“破财”等套话！

请按以下步骤进行：
第一步：客观特征提取。请先抛开玄学，极其客观、准确地描述你在照片中看到的真实五官特征（脸型、眉毛粗细/走向/浓淡、眼睛大小/形状、鼻子高低/宽窄、嘴唇厚薄等）。
第二步：全面面相分析。基于第一步提取的【真实特征】，进行以下维度的解析：
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
            required: ["objectiveFeatures", "fortuneSummary", "facialAnalysis", "eyebrowAnalysis", "luckIssue", "recommendedProjects", "suggestedSolution", "beauticianPitch"]
          }
        }
      });
      
      const data = JSON.parse(response.text || "{}");
      setResult(data);
    } catch (err) {
      console.error(err);
      setError("分析失败，请确保上传了清晰的正面人脸照片并重试。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const exportToImage = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);
    try {
      const url = await toPng(reportRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#f5f5f0',
        filter: (node) => {
          if (hidePitchInExport && node instanceof HTMLElement && node.id === 'beautician-pitch') {
            return false;
          }
          return true;
        }
      });
      const link = document.createElement('a');
      link.download = `面相解析报告_${new Date().getTime()}.png`;
      link.href = url;
      link.click();
    } catch (err) {
      console.error("Export failed", err);
      alert("导出图片失败，请重试");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-serif font-medium text-ink mb-4">
            东方美学 · 面相解析
          </h1>
          <p className="text-lg text-olive-dark font-light max-w-xl mx-auto">
            上传您的面部照片，AI将为您解读面相密码，定制专属开运眉形。
          </p>
        </div>

        {/* Main Content */}
        <div className="card p-8 sm:p-12 relative overflow-hidden min-h-[500px] flex flex-col justify-center mb-8">
          <AnimatePresence mode="wait">
            {!image ? (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center justify-center py-12"
              >
                <div 
                  className="w-64 h-80 rounded-[9999px] border-2 border-dashed border-olive/30 flex flex-col items-center justify-center cursor-pointer hover:bg-olive/5 transition-colors mb-8"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="w-12 h-12 text-olive mb-4" strokeWidth={1.5} />
                  <span className="text-olive-dark font-medium">点击上传正面照</span>
                  <span className="text-sm text-olive/60 mt-2">支持 JPG, PNG</span>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
              </motion.div>
            ) : !result ? (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="flex flex-col items-center"
              >
                <div className="relative mb-8">
                  <img src={image} alt="Uploaded face" className="w-64 h-80 pill-image shadow-lg" />
                  {isAnalyzing && (
                    <div className="absolute inset-0 bg-warm-white/40 backdrop-blur-sm rounded-[9999px] flex items-center justify-center">
                      <Loader2 className="w-12 h-12 text-olive animate-spin" />
                    </div>
                  )}
                </div>
                
                {error && (
                  <div className="text-red-500 mb-4 text-center max-w-md">{error}</div>
                )}

                {!isAnalyzing && !error && (
                  <div className="flex gap-4">
                    <button onClick={reset} className="px-6 py-3 rounded-full border border-olive text-olive hover:bg-olive/5 transition-colors">
                      重新上传
                    </button>
                    <button onClick={analyzeFace} className="olive-button flex items-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      开始解析面相
                    </button>
                  </div>
                )}
                
                {isAnalyzing && (
                  <p className="text-olive-dark font-serif text-xl animate-pulse">
                    正在解读您的面相密码...
                  </p>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center w-full"
              >
                {/* The Report Container */}
                <div 
                  ref={reportRef}
                  className="w-full bg-[#f5f5f0] p-8 sm:p-12 rounded-none sm:rounded-3xl border-x-0 sm:border border-olive/20 shadow-none sm:shadow-2xl relative overflow-hidden"
                >
                  {/* Decorative Header Line */}
                  <div className="absolute top-0 left-0 w-full h-2 bg-olive"></div>
                  
                  {/* Report Header */}
                  <div className="text-center mb-10 mt-4">
                    <h2 className="text-3xl font-serif text-olive-dark tracking-widest mb-2">专属面相解析报告</h2>
                    <p className="text-olive/60 text-sm tracking-widest uppercase">Oriental Aesthetics Report</p>
                  </div>

                  <div className="flex flex-col md:flex-row gap-8 mb-8">
                    {/* Photo & Summary */}
                    <div className="w-full md:w-1/3 flex flex-col items-center">
                      <img src={image} alt="Analyzed face" className="w-48 h-60 object-cover rounded-[9999px] shadow-lg mb-6 border-4 border-white" />
                    </div>
                    
                    <div className="w-full md:w-2/3 flex flex-col justify-center">
                      <h3 className="text-2xl font-serif text-olive-dark mb-4 leading-tight">
                        "{result.fortuneSummary}"
                      </h3>
                      <div className="h-px w-16 bg-olive/30 mb-6"></div>
                      
                      <div className="space-y-6">
                        <div className="bg-white/50 p-4 rounded-xl border border-olive/10">
                          <h4 className="text-xs font-bold text-olive uppercase tracking-widest mb-2">AI 视觉特征提取</h4>
                          <p className="text-ink/70 leading-relaxed text-sm italic">"{result.objectiveFeatures}"</p>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-olive uppercase tracking-widest mb-2">面相骨相</h4>
                          <p className="text-ink/80 leading-relaxed text-sm">{result.facialAnalysis}</p>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-olive uppercase tracking-widest mb-2">眉眼玄机</h4>
                          <p className="text-ink/80 leading-relaxed text-sm">{result.eyebrowAnalysis}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Luck Issue & Solution */}
                  <div className="bg-olive/5 p-6 rounded-2xl border border-olive/10 mb-8">
                    <h4 className="text-xs font-bold text-olive uppercase tracking-widest mb-2">运势诊断</h4>
                    <p className="text-olive-dark leading-relaxed text-sm font-medium">{result.luckIssue}</p>
                  </div>

                  <div className="pt-6 border-t border-olive/10">
                    <h3 className="text-sm font-bold text-olive uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      专属开运方案
                    </h3>
                    <div className="bg-olive text-white p-6 rounded-2xl shadow-md">
                      {result.recommendedProjects && result.recommendedProjects.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {result.recommendedProjects.map((proj, idx) => (
                            <span key={idx} className="bg-white/20 text-white px-3 py-1 rounded-full text-xs font-medium border border-white/30">
                              {proj}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="font-serif text-lg leading-relaxed">{result.suggestedSolution}</p>
                      
                      <div id="beautician-pitch" className="bg-white/10 p-4 rounded-xl mt-6">
                        <p className="text-xs font-bold text-white/70 uppercase tracking-widest mb-2">美业顾问诊断建议</p>
                        <p className="text-white/90 text-sm leading-relaxed italic">"{result.beauticianPitch}"</p>
                      </div>
                    </div>
                  </div>

                  {/* Report Footer */}
                  <div className="mt-12 pt-6 border-t border-olive/20 flex justify-between items-end">
                    <div className="text-olive/50 text-xs font-serif space-y-1">
                      <p>仅供娱乐参考 · 发现更美的自己</p>
                      <p>生成时间: {new Date().toLocaleDateString()}</p>
                    </div>
                    <div className="text-[#c93a3a] border-2 border-[#c93a3a] rounded px-2 py-1 text-xs font-bold font-serif transform -rotate-12 opacity-80 select-none">
                      东方美学<br/>专属定制
                    </div>
                  </div>
                </div>

                {/* Actions (Outside Report) */}
                <div className="flex flex-col items-center gap-6 mt-8">
                  <label className="flex items-center gap-2 text-sm text-olive-dark cursor-pointer bg-olive/5 px-4 py-2 rounded-full border border-olive/10 hover:bg-olive/10 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={hidePitchInExport} 
                      onChange={(e) => setHidePitchInExport(e.target.checked)}
                      className="w-4 h-4 rounded border-olive/30 text-olive focus:ring-olive accent-olive"
                    />
                    导出图片时隐藏「美业顾问诊断建议」（适合发给客户）
                  </label>
                  <div className="flex gap-4">
                    <button onClick={reset} className="px-6 py-3 rounded-full border border-olive text-olive hover:bg-olive/5 transition-colors flex items-center gap-2">
                      <RefreshCcw className="w-4 h-4" />
                      重新测试
                    </button>
                    <button 
                      onClick={exportToImage} 
                      disabled={isExporting}
                      className="olive-button flex items-center gap-2 disabled:opacity-70"
                    >
                      {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                      {isExporting ? '生成中...' : '一键导出报告'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
