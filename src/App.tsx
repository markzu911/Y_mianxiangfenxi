import React, { useState, useRef, useEffect } from 'react';
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
      if (file.size > 20 * 1024 * 1024) {
        setError("图片大小超过 20MB，请压缩后重新上传。");
        return;
      }
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
    <div className="min-h-screen flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8 relative">
      {/* SaaS Integral Display */}
      {integral !== null && (
        <div className="absolute top-6 right-6 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm border border-olive/10 flex items-center gap-2 z-10 hidden sm:flex">
          <Sparkles className="w-4 h-4 text-olive" />
          <span className="text-sm font-medium text-olive-dark">积分余额: </span>
          <span className="text-sm font-bold text-olive">{integral}</span>
        </div>
      )}
      
      {integral !== null && (
        <div className="sm:hidden w-full max-w-4xl text-right mb-4 pr-2">
           <span className="text-xs font-medium text-olive-dark bg-white/80 px-3 py-1 rounded-full border border-olive/10">积分: <span className="font-bold">{integral}</span></span>
        </div>
      )}
      
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
                  <span className="text-sm text-olive/60 mt-2">支持 JPG, PNG，最大 20MB</span>
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
                  <div className="flex flex-col items-center gap-4">
                    <div className="text-red-500 mb-2 text-center max-w-md bg-red-50 p-4 rounded-xl border border-red-100">
                      <p className="font-medium">{error}</p>
                    </div>
                    <button onClick={reset} className="px-6 py-3 rounded-full border border-olive text-olive hover:bg-olive/5 transition-colors flex items-center gap-2">
                      <RefreshCcw className="w-4 h-4" />
                      重新上传照片
                    </button>
                  </div>
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
