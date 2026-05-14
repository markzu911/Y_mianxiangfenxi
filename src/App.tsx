import React, { useState, useRef, useEffect } from 'react';
import { Camera, Loader2, RefreshCcw, Sparkles, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toJpeg } from 'html-to-image';
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
  const hasUploadedRef = useRef(false);

  useEffect(() => {
    hasUploadedRef.current = false;
  }, [result]);

  useEffect(() => {
    if (result && !isAnalyzing && reportRef.current && saasUserId && saasToolId && !hasUploadedRef.current) {
      hasUploadedRef.current = true;
      const timer = setTimeout(async () => {
        try {
          const imageBase64 = await toJpeg(reportRef.current!, {
             quality: 0.85,
             pixelRatio: 1, // Keep string length short to avoid 413
             backgroundColor: '#f5f5f0'
          });

          // Convert to Blob
          const resBlob = await fetch(imageBase64);
          const blob = await resBlob.blob();

          // 1. Get token
          const tokenRes = await fetch('/api/upload/direct-token', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
                 userId: saasUserId,
                 toolId: saasToolId,
                 source: 'result',
                 mimeType: 'image/jpeg',
                 fileName: 'report.jpg',
                 fileSize: blob.size
             })
          });
          const tokenData = await tokenRes.json();
          if (!tokenData.success) {
            throw new Error(tokenData.error || tokenData.message || '获取上传地址失败');
          }

          // 2. PUT OSS
          const uploadRes = await fetch(tokenData.uploadUrl, {
            method: tokenData.method || 'PUT',
            headers: tokenData.headers,
            body: blob
          });
          if (!uploadRes.ok) {
            throw new Error(`OSS上传失败: ${uploadRes.status}`);
          }

          // 3. Commit
          const commitRes = await fetch('/api/upload/commit', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
                 userId: saasUserId,
                 toolId: saasToolId,
                 source: 'result',
                 objectKey: tokenData.objectKey,
                 fileSize: blob.size
             })
          });
          const commitData = await commitRes.json();
          if (!commitData.success || !commitData.savedToRecords) {
            throw new Error(commitData.error || '上传确认失败');
          }
          console.log("Image saved to SaaS successfully");

        } catch (e) {
          console.error("Auto upload failed", e);
          hasUploadedRef.current = false;
        }
      }, 800); // Slight delay for fonts/images to fully render
      return () => clearTimeout(timer);
    }
  }, [result, isAnalyzing, saasUserId, saasToolId]);

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
      // Basic size check for the raw file
      if (file.size > 20 * 1024 * 1024) {
        setError("图片文件过大，请选择 20MB 以内的图片。");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.src = reader.result as string;
        img.onload = () => {
          // Client-side resizing to ensure we don't hit 413 or slow down the AI
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDimension = 1600;

          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            // Compress as JPEG even if source was PNG to save space
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
            setImage(compressedBase64);
            setResult(null);
            setError(null);
          }
        };
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
          projectsContext,
          userId: saasUserId,
          toolId: saasToolId
        })
      });

      if (!generateRes.ok) {
        const errorData = await generateRes.json();
        throw new Error(errorData.error || 'AI analysis failed');
      }

      const data = await generateRes.json();
      
      if (data.isValidFace === false) {
        setError(data.invalidReason || "未检测到有效的人脸，请重新上传清晰的正面人脸照片。");
      } else {
        setResult(data);
        
        // Refresh integral from a separate launch call or just decrement locally?
        // Better to calling launch again or rely on the backend to handle it.
        // The spec implies the backend handles it. We can just refresh integral.
        if (saasUserId && saasToolId) {
          fetch('/api/tool/launch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: saasUserId, toolId: saasToolId })
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
    } catch (err: any) {
      console.error(err);
      setError(err.message || "分析失败，请确保上传了清晰的正面人脸照片并重试。");
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
      const url = await toJpeg(reportRef.current, {
        quality: 0.95,
        pixelRatio: window.devicePixelRatio > 1 ? 2 : 1,
        backgroundColor: '#f5f5f0',
        filter: (node) => {
          if (hidePitchInExport && node instanceof HTMLElement && node.id === 'beautician-pitch') {
            return false;
          }
          return true;
        }
      });
      const link = document.createElement('a');
      link.download = `面相解析报告_${new Date().getTime()}.jpg`;
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
    <div className="min-h-screen flex flex-col items-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8 relative">
      {/* SaaS Integral Display */}
      {integral !== null && (
        <div className="absolute top-4 sm:top-6 right-4 sm:right-6 bg-white/80 backdrop-blur-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-sm border border-olive/10 flex items-center gap-2 z-10 hidden sm:flex">
          <Sparkles className="w-3.5 h-3.5 sm:w-4 h-4 text-olive" />
          <span className="text-xs sm:text-sm font-medium text-olive-dark">积分余额: </span>
          <span className="text-xs sm:text-sm font-bold text-olive">{integral}</span>
        </div>
      )}
      
      {integral !== null && (
        <div className="sm:hidden w-full max-w-4xl text-right mb-4 pr-1">
           <span className="text-[10px] sm:text-xs font-medium text-olive-dark bg-white/80 px-2 sm:px-3 py-1 rounded-full border border-olive/10 backdrop-blur-sm">积分: <span className="font-bold">{integral}</span></span>
        </div>
      )}
      
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-medium text-ink mb-3 sm:mb-4 px-2">
            东方美学 · 面相解析
          </h1>
          <p className="text-sm sm:text-lg text-olive-dark font-light max-w-xl mx-auto px-4">
            上传您的面部照片，AI将为您解读面相密码，定制专属开运眉形。
          </p>
        </div>

        {/* Main Content */}
        <div className="card p-5 sm:p-8 md:p-12 relative overflow-hidden min-h-[400px] sm:min-h-[500px] flex flex-col justify-center mb-8">
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
                  className="w-48 h-60 sm:w-64 sm:h-80 rounded-[9999px] border-2 border-dashed border-olive/30 flex flex-col items-center justify-center cursor-pointer hover:bg-olive/5 transition-colors mb-6 sm:mb-8 p-4 text-center"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="w-8 h-8 sm:w-12 sm:h-12 text-olive mb-3 sm:mb-4" strokeWidth={1.5} />
                  <span className="text-sm sm:text-base text-olive-dark font-medium">点击上传正面照</span>
                  <span className="text-[10px] sm:text-sm text-olive/60 mt-2">支持常见格式，最大 20MB</span>
                </div>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  accept="image/jpeg,image/png,image/webp,image/bmp,image/heic,image/heif" 
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
                <div className="relative mb-6 sm:mb-8">
                  <img src={image} alt="Uploaded face" className="w-48 h-60 sm:w-64 sm:h-80 pill-image shadow-lg" />
                  {isAnalyzing && (
                    <div className="absolute inset-0 bg-warm-white/40 backdrop-blur-sm rounded-[9999px] flex items-center justify-center">
                      <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 text-olive animate-spin" />
                    </div>
                  )}
                </div>
                
                {error && (
                  <div className="flex flex-col items-center gap-4 px-2">
                    <div className="text-red-500 mb-2 text-center max-w-md bg-red-50 p-4 rounded-xl border border-red-100 text-sm sm:text-base">
                      <p className="font-medium">{error}</p>
                    </div>
                    <button onClick={reset} className="px-5 py-2.5 sm:px-6 sm:py-3 rounded-full border border-olive text-olive hover:bg-olive/5 transition-colors flex items-center gap-2 text-sm sm:text-base">
                      <RefreshCcw className="w-4 h-4" />
                      重新上传照片
                    </button>
                  </div>
                )}

                {!isAnalyzing && !error && (
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto px-6 sm:px-0">
                    <button onClick={reset} className="px-6 py-2.5 sm:py-3 rounded-full border border-olive text-olive hover:bg-olive/5 transition-colors text-sm sm:text-base">
                      重新上传
                    </button>
                    <button onClick={analyzeFace} className="olive-button flex items-center justify-center gap-2 text-sm sm:text-base py-2.5 sm:py-3">
                      <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                      开始解析面相
                    </button>
                  </div>
                )}
                
                {isAnalyzing && (
                  <p className="text-olive-dark font-serif text-lg sm:text-xl animate-pulse text-center px-4">
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
                  className="w-full bg-[#f5f5f0] p-5 sm:p-8 md:p-12 rounded-2xl sm:rounded-3xl border sm:border-olive/20 shadow-none sm:shadow-2xl relative overflow-hidden"
                >
                  {/* Decorative Header Line */}
                  <div className="absolute top-0 left-0 w-full h-1.5 sm:h-2 bg-olive"></div>
                  
                  {/* Report Header */}
                  <div className="text-center mb-8 sm:mb-10 mt-2 sm:mt-4">
                    <h2 className="text-xl sm:text-3xl font-serif text-olive-dark tracking-[0.2em] sm:tracking-widest mb-1 sm:mb-2">专属面相解析报告</h2>
                    <p className="text-olive/60 text-[10px] sm:text-sm tracking-widest uppercase">Oriental Aesthetics Report</p>
                  </div>

                  <div className="flex flex-col md:flex-row gap-6 sm:gap-8 mb-6 sm:mb-8">
                    {/* Photo & Summary */}
                    <div className="w-full md:w-1/3 flex flex-col items-center">
                      <img src={image} alt="Analyzed face" className="w-40 h-52 sm:w-48 sm:h-60 object-cover rounded-[9999px] shadow-lg mb-4 sm:mb-6 border-4 border-white" />
                    </div>
                    
                    <div className="w-full md:w-2/3 flex flex-col justify-center text-center md:text-left">
                      <h3 className="text-xl sm:text-2xl font-serif text-olive-dark mb-4 leading-tight">
                        "{result.fortuneSummary}"
                      </h3>
                      <div className="h-px w-12 sm:w-16 bg-olive/30 mb-5 sm:mb-6 mx-auto md:ml-0"></div>
                      
                      <div className="space-y-4 sm:space-y-6">
                        <div className="bg-white/50 p-3 sm:p-4 rounded-xl border border-olive/10">
                          <h4 className="text-[10px] sm:text-xs font-bold text-olive uppercase tracking-widest mb-1.5 sm:mb-2">AI 视觉特征提取</h4>
                          <p className="text-ink/70 leading-relaxed text-xs sm:text-sm italic">"{result.objectiveFeatures}"</p>
                        </div>
                        <div>
                          <h4 className="text-[10px] sm:text-xs font-bold text-olive uppercase tracking-widest mb-1.5 sm:mb-2">面相骨相</h4>
                          <p className="text-ink/80 leading-relaxed text-xs sm:text-sm">{result.facialAnalysis}</p>
                        </div>
                        <div>
                          <h4 className="text-[10px] sm:text-xs font-bold text-olive uppercase tracking-widest mb-1.5 sm:mb-2">眉眼玄机</h4>
                          <p className="text-ink/80 leading-relaxed text-xs sm:text-sm">{result.eyebrowAnalysis}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Luck Issue & Solution */}
                  <div className="bg-olive/5 p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-olive/10 mb-6 sm:mb-8">
                    <h4 className="text-[10px] sm:text-xs font-bold text-olive uppercase tracking-widest mb-1.5 sm:mb-2">运势诊断</h4>
                    <p className="text-olive-dark leading-relaxed text-xs sm:text-sm font-medium">{result.luckIssue}</p>
                  </div>

                  <div className="pt-5 sm:pt-6 border-t border-olive/10">
                    <h3 className="text-[10px] sm:text-sm font-bold text-olive uppercase tracking-widest mb-4 flex items-center justify-center md:justify-start gap-2">
                      <Sparkles className="w-3.5 h-3.5 sm:w-4 h-4" />
                      专属开运方案
                    </h3>
                    <div className="bg-olive text-white p-5 sm:p-6 rounded-xl sm:rounded-2xl shadow-md">
                      {result.recommendedProjects && result.recommendedProjects.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-3 sm:mb-4 justify-center md:justify-start">
                          {result.recommendedProjects.map((proj, idx) => (
                            <span key={idx} className="bg-white/20 text-white px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium border border-white/30">
                              {proj}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="font-serif text-base sm:text-lg leading-relaxed text-center md:text-left">{result.suggestedSolution}</p>
                      
                      <div id="beautician-pitch" className="bg-white/10 p-3 sm:p-4 rounded-xl mt-5 sm:mt-6">
                        <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-1.5 sm:mb-2">美业顾问诊断建议</p>
                        <p className="text-white/90 text-xs sm:text-sm leading-relaxed italic">"{result.beauticianPitch}"</p>
                      </div>
                    </div>
                  </div>

                  {/* Report Footer */}
                  <div className="mt-8 sm:mt-12 pt-5 sm:pt-6 border-t border-olive/20 flex justify-between items-end">
                    <div className="text-olive/50 text-[10px] sm:text-xs font-serif space-y-1">
                      <p>仅供娱乐参考 · 发现更美的自己</p>
                      <p>生成时间: {new Date().toLocaleDateString()}</p>
                    </div>
                    <div className="text-[#c93a3a] border-2 border-[#c93a3a] rounded px-1.5 py-0.5 sm:px-2 sm:py-1 text-[10px] sm:text-xs font-bold font-serif transform -rotate-12 opacity-80 select-none">
                      东方美学<br/>专属定制
                    </div>
                  </div>
                </div>

                {/* Actions (Outside Report) */}
                <div className="flex flex-col items-center gap-5 sm:gap-6 mt-6 sm:mt-8 w-full px-2">
                  <label className="flex items-center gap-3 text-xs sm:text-sm text-olive-dark cursor-pointer bg-olive/5 px-4 py-2.5 rounded-xl sm:rounded-full border border-olive/10 hover:bg-olive/10 transition-colors w-full sm:w-auto text-center sm:text-left">
                    <input 
                      type="checkbox" 
                      checked={hidePitchInExport} 
                      onChange={(e) => setHidePitchInExport(e.target.checked)}
                      className="w-4 h-4 rounded border-olive/30 text-olive focus:ring-olive accent-olive flex-shrink-0"
                    />
                    <span>导出图片时隐藏「美业顾问诊断建议」</span>
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
                    <button onClick={reset} className="px-6 py-2.5 sm:py-3 rounded-full border border-olive text-olive hover:bg-olive/5 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base order-2 sm:order-1">
                      <RefreshCcw className="w-4 h-4" />
                      重新测试
                    </button>
                    <button 
                      onClick={exportToImage} 
                      disabled={isExporting}
                      className="olive-button flex items-center justify-center gap-2 text-sm sm:text-base py-2.5 sm:py-3 disabled:opacity-70 order-1 sm:order-2"
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
