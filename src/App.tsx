import { useState, useRef, useEffect } from 'react';
import { Camera, Loader2, RefreshCcw, Sparkles, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toPng } from 'html-to-image';
import { beautyProjects } from './lib/beautyProjects';

interface AnalysisResult {
  isValidFace: boolean;
  invalidReason: string;
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
  
  // SaaS State
  const [saasUserId, setSaasUserId] = useState<string | null>(null);
  const [saasToolId, setSaasToolId] = useState<string | null>(null);
  const [saasContext, setSaasContext] = useState<string>('');
  const [integral, setIntegral] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SAAS_INIT') {
        if (event.data.userId && event.data.userId !== "null" && event.data.userId !== "undefined") {
          setSaasUserId(event.data.userId);
        }
        if (event.data.toolId && event.data.toolId !== "null" && event.data.toolId !== "undefined") {
          setSaasToolId(event.data.toolId);
        }
        if (event.data.context) {
          setSaasContext(event.data.context);
        }
        
        // Launch Request
        if (event.data.userId && event.data.toolId) {
           fetch('/api/tool/launch', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ userId: event.data.userId, toolId: event.data.toolId })
           })
           .then(res => res.json())
           .then(data => {
             if (data?.success && data?.data?.user?.integral !== undefined) {
               setIntegral(data.data.user.integral);
             }
           })
           .catch(console.error);
        }
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

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
    
    // SaaS Verify Integration
    if (saasUserId && saasToolId) {
      try {
        const verifyRes = await fetch('/api/tool/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: saasUserId, toolId: saasToolId })
        });
        const verifyData = await verifyRes.json();
        if (!verifyData.success && !verifyData.valid) { // Loose checking
          setError(verifyData.message || "积分不足");
          setIsAnalyzing(false);
          return;
        }
        if (verifyData?.data?.currentIntegral !== undefined) {
          setIntegral(verifyData.data.currentIntegral);
        }
      } catch (err) {
        console.error("SaaS verification failed:", err);
      }
    }

    const projectsContext = beautyProjects.map(p => 
      `- ${p.name} (${p.category}): ${p.description} 【玄学功效: ${p.fengshuiBenefit}】`
    ).join('\n');
    
    // Combine SaaS context if available
    const extraContextPrompt = saasContext ? `\n【补充客户背景或需求】：${saasContext}\n` : '';

    try {
      const generateRes = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: image.split(',')[1],
          mimeType: image.split(';')[0].split(':')[1],
          extraContextPrompt,
          projectsContext
        })
      });

      if (!generateRes.ok) {
        throw new Error('AI analysis failed');
      }

      const data = await generateRes.json();
      
      if (data.isValidFace === false) {
        setError(data.invalidReason || "未检测到有效的人脸，请重新上传清晰的正面人脸照片。");
      } else {
        setResult(data);
        
        // SaaS Consume Integration
        if (saasUserId && saasToolId) {
          fetch('/api/tool/consume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: saasUserId, toolId: saasToolId })
          })
          .then(res => res.json())
          .then(data => {
            if (data?.success && data?.data?.currentIntegral !== undefined) {
              setIntegral(data.data.currentIntegral);
            }
          })
          .catch(console.error);
        }
      }
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
        backgroundColor: '#ffffff',
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
    <div className="min-h-screen flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 relative">
      {/* SaaS Integral Display */}
      {integral !== null && (
        <div className="absolute top-6 right-6 bg-white px-4 py-2 rounded-md shadow-sm border border-zinc-200 flex items-center gap-2 z-10 hidden sm:flex">
          <Sparkles className="w-4 h-4 text-zinc-400" />
          <span className="text-sm font-medium text-zinc-500">积分余额: </span>
          <span className="text-sm font-bold text-black">{integral}</span>
        </div>
      )}
      
      {integral !== null && (
        <div className="sm:hidden w-full max-w-4xl text-right mb-4 pr-2">
           <span className="text-xs font-medium text-zinc-500 bg-white px-3 py-1 rounded-md border border-zinc-200">积分: <span className="font-bold text-black">{integral}</span></span>
        </div>
      )}
      
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-serif font-light text-black mb-6 tracking-tight">
            东方美学 · 面相解析
          </h1>
          <div className="w-12 h-0.5 bg-black mx-auto mb-6"></div>
          <p className="text-lg text-zinc-500 font-light max-w-xl mx-auto tracking-wide">
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
                  className="w-64 h-80 rounded-md border border-dashed border-zinc-300 flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-50 transition-all mb-8"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="w-10 h-10 text-zinc-300 mb-4" strokeWidth={1} />
                  <span className="text-zinc-600 font-light tracking-widest text-sm">点击上传正面照</span>
                  <span className="text-[10px] text-zinc-400 mt-2 uppercase tracking-widest">JPG, PNG</span>
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
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm rounded-md flex items-center justify-center">
                      <Loader2 className="w-12 h-12 text-black animate-spin" strokeWidth={1} />
                    </div>
                  )}
                </div>
                
                {error && (
                  <div className="flex flex-col items-center gap-4">
                    <div className="text-zinc-900 border border-zinc-200 mb-2 text-center max-w-md bg-white p-6 rounded-md">
                      <p className="font-light">{error}</p>
                    </div>
                    <button onClick={reset} className="px-8 py-3 rounded-md border border-black text-black hover:bg-black hover:text-white transition-all flex items-center gap-2 text-sm uppercase tracking-widest">
                      <RefreshCcw className="w-4 h-4" />
                      重新上传照片
                    </button>
                  </div>
                )}

                {!isAnalyzing && !error && (
                  <div className="flex gap-4">
                    <button onClick={reset} className="px-8 py-3 rounded-md border border-zinc-200 text-zinc-500 hover:border-black hover:text-black transition-all text-sm uppercase tracking-widest">
                      重新上传
                    </button>
                    <button onClick={analyzeFace} className="olive-button flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      开始解析面相
                    </button>
                  </div>
                )}
                
                {isAnalyzing && (
                  <p className="text-black font-serif text-2xl font-light italic animate-pulse">
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
                  className="w-full bg-white p-8 sm:p-16 rounded-none border-x-0 sm:border border-black shadow-none relative overflow-hidden"
                >
                  {/* Decorative Header Line */}
                  <div className="absolute top-0 left-0 w-full h-1 bg-black"></div>
                  
                  {/* Report Header */}
                  <div className="text-center mb-16 mt-4">
                    <h2 className="text-4xl font-serif text-black tracking-[0.2em] uppercase mb-4">专属面相解析报告</h2>
                    <div className="w-32 h-[1px] bg-black mx-auto opacity-20"></div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-12 mb-12">
                    {/* Photo & Summary */}
                    <div className="w-full md:w-1/3 flex flex-col items-center">
                      <img src={image} alt="Analyzed face" className="w-48 h-64 object-cover rounded-none grayscale shadow-none mb-6 border border-zinc-200" />
                    </div>
                    
                    <div className="w-full md:w-2/3 flex flex-col justify-center">
                      <h3 className="text-3xl font-serif text-black mb-8 leading-tight font-light border-l-4 border-black pl-6">
                        "{result.fortuneSummary}"
                      </h3>
                      
                      <div className="space-y-8">
                        <div>
                          <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.3em] mb-3">AI 视觉特征提取</h4>
                          <p className="text-zinc-500 leading-relaxed text-sm italic font-light">"{result.objectiveFeatures}"</p>
                        </div>
                        <div>
                          <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.3em] mb-3">面相骨相</h4>
                          <p className="text-zinc-800 leading-relaxed text-sm font-light">{result.facialAnalysis}</p>
                        </div>
                        <div>
                          <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.3em] mb-3">眉眼玄机</h4>
                          <p className="text-zinc-800 leading-relaxed text-sm font-light">{result.eyebrowAnalysis}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Luck Issue & Solution */}
                  <div className="bg-zinc-50 p-8 border-l border-r border-black/5 mb-12">
                    <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.3em] mb-4">运势诊断</h4>
                    <p className="text-black leading-relaxed font-serif text-lg font-light tracking-wide">{result.luckIssue}</p>
                  </div>

                  <div className="pt-12 border-t border-black/10">
                    <h3 className="text-[10px] font-bold text-black uppercase tracking-[0.3em] mb-8 flex items-center gap-2">
                       专属开运方案
                    </h3>
                    <div className="bg-black text-white p-8 rounded-none">
                      {result.recommendedProjects && result.recommendedProjects.length > 0 && (
                        <div className="flex flex-wrap gap-3 mb-8">
                          {result.recommendedProjects.map((proj, idx) => (
                            <span key={idx} className="bg-white/10 text-white px-4 py-1.5 rounded-none text-[10px] uppercase tracking-widest border border-white/20">
                              {proj}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="font-serif text-xl leading-relaxed font-light">{result.suggestedSolution}</p>
                      
                      <div id="beautician-pitch" className="bg-white text-black p-6 mt-10">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.3em] mb-3">美业顾问诊断建议</p>
                        <p className="text-black text-sm leading-relaxed italic font-light">"{result.beauticianPitch}"</p>
                      </div>
                    </div>
                  </div>

                  {/* Report Footer */}
                  <div className="mt-16 pt-8 border-t border-black/20 flex justify-between items-end">
                    <div className="text-zinc-400 text-[10px] uppercase tracking-widest space-y-2">
                      <p>仅供娱乐参考 · 发现更美的自己</p>
                      <p>生成时间: {new Date().toLocaleDateString()}</p>
                    </div>
                    <div className="text-black border border-black px-4 py-2 text-[10px] font-bold tracking-[0.4em] uppercase transform -rotate-2 select-none">
                      东方美学 · 定制
                    </div>
                  </div>
                </div>

                {/* Actions (Outside Report) */}
                <div className="flex flex-col items-center gap-8 mt-12 pb-12">
                  <label className="flex items-center gap-3 text-xs text-zinc-400 cursor-pointer bg-white px-6 py-3 rounded-md border border-zinc-100 hover:border-black transition-all">
                    <input 
                      type="checkbox" 
                      checked={hidePitchInExport} 
                      onChange={(e) => setHidePitchInExport(e.target.checked)}
                      className="w-4 h-4 rounded-none border-zinc-300 text-black focus:ring-0 focus:ring-offset-0 accent-black"
                    />
                    导出时隐藏「美业顾问诊断建议」
                  </label>
                  <div className="flex gap-4">
                    <button onClick={reset} className="px-10 py-4 rounded-md border border-zinc-200 text-zinc-400 hover:border-black hover:text-black transition-all flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] font-medium">
                      <RefreshCcw className="w-4 h-4" />
                      重新测试
                    </button>
                    <button 
                      onClick={exportToImage} 
                      disabled={isExporting}
                      className="px-10 py-4 bg-black text-white rounded-md border border-black hover:bg-white hover:text-black transition-all flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] font-medium disabled:opacity-30"
                    >
                      {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      {isExporting ? '生成中...' : '导出报告'}
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
