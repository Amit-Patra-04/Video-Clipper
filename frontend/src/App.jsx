import { useState, useEffect, useRef } from 'react';
import Header from './components/Common/Header';
import NotificationToast from './components/Common/NotificationToast';
import IngestionFlow from './components/Ingestion/IngestionFlow';
import PipelineStatus from './components/Pipeline/PipelineStatus';
import VideoPlayer from './components/Editor/VideoPlayer';
import Timeline from './components/Editor/Timeline';
import CaptionCustomizer from './components/Editor/CaptionCustomizer';
import AspectRatioSelector from './components/Editor/AspectRatioSelector';
import TransitionPicker from './components/Editor/TransitionPicker';
import HighlightLeaderboard from './components/Highlights/HighlightLeaderboard';
import MetadataStudio from './components/Metadata/MetadataStudio';
import ExportDialog from './components/Export/ExportDialog';
import { apiClient } from './api/client';
import { Flame, Type, TrendingUp, Download, Film, Sparkles, Layers } from 'lucide-react';

export default function App() {
  // App view stage: 'ingest' | 'pipeline' | 'editor'
  const [stage, setStage] = useState('ingest');
  const [notification, setNotification] = useState(null);

  // Ingestion & Job state
  const [videoId, setVideoId] = useState(null);
  const [videoTitle, setVideoTitle] = useState('My Video Project');
  const [videoSrc, setVideoSrc] = useState('');

  // Pipeline state
  const [pipelineProgress, setPipelineProgress] = useState({
    video_id: '',
    status: 'idle',
    current_stage: 'probing',
    progress: 0,
    message: '',
    stages_completed: []
  });

  // Editor state
  const [totalDuration, setTotalDuration] = useState(60);
  const [currentTime, setCurrentTime] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(30);
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [activeTab, setActiveTab] = useState('highlights'); // 'highlights' | 'captions' | 'metadata' | 'transitions'

  // Kinetic Caption Config
  const [captionConfig, setCaptionConfig] = useState({
    preset: 'hormozi',
    fontFamily: 'font-sans',
    fontSize: 28,
    fontSizeClass: 'text-2xl',
    textColorClass: 'text-yellow-400',
    activeColor: '#facc15',
    bgColorClass: '',
    position: 'bottom'
  });

  // Data stores
  const [clips, setClips] = useState([]);
  const [selectedClip, setSelectedClip] = useState(null);
  const [segments, setSegments] = useState([]);
  const [metadataSuite, setMetadataSuite] = useState(null);
  const [isMetadataLoading, setIsMetadataLoading] = useState(false);

  // Export Modal state
  const [isExportOpen, setIsExportOpen] = useState(false);

  const pollIntervalRef = useRef(null);

  const loadMetadata = async (vId, cId) => {
    setIsMetadataLoading(true);
    try {
      const data = await apiClient.generateMetadata(vId, cId);
      setMetadataSuite(data);
    } catch (err) {
      console.error('Metadata generation error:', err);
    } finally {
      setIsMetadataLoading(false);
    }
  };

  // Poll pipeline progress while processing
  useEffect(() => {
    if (stage === 'pipeline' && videoId) {
      pollIntervalRef.current = setInterval(async () => {
        try {
          const status = await apiClient.getPipelineStatus(videoId);
          setPipelineProgress(status);

          if (status.status === 'completed') {
            clearInterval(pollIntervalRef.current);
            // Fetch clips and transcripts
            const fetchedClips = await apiClient.getClips(videoId);
            const fetchedTranscripts = await apiClient.getTranscripts(videoId);
            setClips(fetchedClips);
            setSegments(fetchedTranscripts);

            if (fetchedClips.length > 0) {
              const top = fetchedClips[0];
              setSelectedClip(top);
              setTrimStart(top.start);
              setTrimEnd(top.end);
              setCurrentTime(top.start);
            }

            // Fetch metadata
            loadMetadata(videoId, fetchedClips[0]?.id);

            setStage('editor');
            setNotification({
              type: 'success',
              message: 'Analysis complete! Viral clips are ready in the editor.'
            });
          } else if (status.status === 'failed') {
            clearInterval(pollIntervalRef.current);
            setNotification({
              type: 'error',
              message: status.error || 'Pipeline failed during processing.'
            });
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 1500);
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [stage, videoId]);

  const handleUploadSuccess = jobData => {
    setVideoId(jobData.video_id);
    setVideoTitle(jobData.filename || 'Uploaded Video');
    if (jobData.file_path) {
      setVideoSrc(`/storage/uploads/${jobData.video_id}_${jobData.filename}`);
    }
    setNotification({
      type: 'success',
      message: `Upload successful, job queued! Job ID: ${jobData.job_id}`
    });
    setStage('pipeline');
  };

  // Quick Demo Loader
  const handleDemoLoad = () => {
    const demoId = 'demo_' + Date.now();
    setVideoId(demoId);
    setVideoTitle('Mastering High-Retention YouTube Hooks');
    setTotalDuration(60.0);
    setTrimStart(4.5);
    setTrimEnd(34.2);
    setCurrentTime(4.5);
    // Use an online royalty free sample video
    setVideoSrc(
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
    );

    const demoSegments = [
      {
        id: 1,
        speaker: 'Speaker 1',
        start: 4.5,
        end: 14.2,
        text: 'The secret reason why everyone fails at virality revealed.',
        words: [
          { word: 'THE', start: 4.5, end: 5.2 },
          { word: 'SECRET', start: 5.2, end: 6.4 },
          { word: 'REASON', start: 6.4, end: 7.3 },
          { word: 'WHY', start: 7.3, end: 8.0 },
          { word: 'EVERYONE', start: 8.0, end: 9.1 },
          { word: 'FAILS', start: 9.1, end: 10.2 },
          { word: 'AT', start: 10.2, end: 10.8 },
          { word: 'VIRALITY', start: 10.8, end: 12.3 },
          { word: 'REVEALED', start: 12.3, end: 14.2 }
        ]
      },
      {
        id: 2,
        speaker: 'Speaker 2',
        start: 15.0,
        end: 25.5,
        text: 'When you change your hook by 300 percent, viewers stay hooked.',
        words: [
          { word: 'WHEN', start: 15.0, end: 15.8 },
          { word: 'YOU', start: 15.8, end: 16.5 },
          { word: 'CHANGE', start: 16.5, end: 17.5 },
          { word: 'YOUR', start: 17.5, end: 18.2 },
          { word: 'HOOK', start: 18.2, end: 19.3 },
          { word: 'BY', start: 19.3, end: 20.0 },
          { word: '300', start: 20.0, end: 21.2 },
          { word: 'PERCENT', start: 21.2, end: 22.8 },
          { word: 'VIEWERS', start: 22.8, end: 24.1 },
          { word: 'STAY', start: 24.1, end: 25.5 }
        ]
      },
      {
        id: 3,
        speaker: 'Speaker 1',
        start: 26.0,
        end: 34.2,
        text: 'This is the exact formula that took our channel from zero to millions.',
        words: [
          { word: 'THIS', start: 26.0, end: 26.8 },
          { word: 'IS', start: 26.8, end: 27.4 },
          { word: 'THE', start: 27.4, end: 28.1 },
          { word: 'EXACT', start: 28.1, end: 29.2 },
          { word: 'FORMULA', start: 29.2, end: 30.5 },
          { word: 'THAT', start: 30.5, end: 31.2 },
          { word: 'TOOK', start: 31.2, end: 32.0 },
          { word: 'OUR', start: 32.0, end: 32.8 },
          { word: 'CHANNEL', start: 32.8, end: 34.2 }
        ]
      }
    ];

    const demoClips = [
      {
        id: 'clip_demo_1',
        video_id: demoId,
        start: 4.5,
        end: 14.2,
        duration: 9.7,
        title: '🔥 The 1 Secret Behind Viral Retention...',
        virality_score: 96,
        score: 96,
        breakdown: {
          hook_score: 98.0,
          audio_energy_score: 94.0,
          visual_pacing_score: 92.0,
          topic_coherence_score: 95.0
        },
        reason:
          'Loud applause opening, high speaking rate (3.4 wps), and keyword trigger (\'secret\').',
        reasons: ['Loud applause opening', 'Fast speaking rate (3.4 wps)', 'Trigger keyword (\'secret\')'],
        transcript_snippet:
          'The secret reason why everyone fails at virality revealed.',
        suggested_aspect_ratio: '9:16'
      },
      {
        id: 'clip_demo_2',
        video_id: demoId,
        start: 15.0,
        end: 25.5,
        duration: 10.5,
        title: '💡 How 300% Hook Spikes Retention',
        virality_score: 91,
        score: 91,
        breakdown: {
          hook_score: 89.0,
          audio_energy_score: 91.0,
          visual_pacing_score: 90.0,
          topic_coherence_score: 88.0
        },
        reason:
          'Scene cut transition and fast speech delivery (3.2 wps) on topic shift.',
        reasons: ['Scene cut at topic transition', 'Fast speech delivery (3.2 wps)', 'High curiosity gap'],
        transcript_snippet: 'When you change your hook by 300 percent, viewers stay hooked.',
        suggested_aspect_ratio: '9:16'
      },
      {
        id: 'clip_demo_3',
        video_id: demoId,
        start: 26.0,
        end: 35.0,
        duration: 9.0,
        title: '⚡ Zero to Millions Growth Formula',
        virality_score: 87,
        score: 87,
        breakdown: {
          hook_score: 86.0,
          audio_energy_score: 88.0,
          visual_pacing_score: 84.0,
          topic_coherence_score: 90.0
        },
        reason:
          'High audio amplitude peak with punchline payoff (\'zero to millions\').',
        reasons: ['High audio amplitude peak', 'Punchline payoff', 'Topic transition'],
        transcript_snippet: 'This is the exact formula that took our channel from zero to millions.',
        suggested_aspect_ratio: '9:16'
      },
      {
        id: 'clip_demo_4',
        video_id: demoId,
        start: 36.0,
        end: 46.5,
        duration: 10.5,
        title: '🎬 Audience Retention Pacing Breakdown',
        virality_score: 82,
        score: 82,
        breakdown: {
          hook_score: 80.0,
          audio_energy_score: 83.0,
          visual_pacing_score: 85.0,
          topic_coherence_score: 81.0
        },
        reason:
          'Visual novelty (2 scene transitions) with steady pacing.',
        reasons: ['Visual novelty (2 scene cuts)', 'Steady speech tempo', 'Clear audio clarity'],
        transcript_snippet: 'Visual cuts every 3 seconds keep mobile attention locked into the video.',
        suggested_aspect_ratio: '9:16'
      },
      {
        id: 'clip_demo_5',
        video_id: demoId,
        start: 48.0,
        end: 58.0,
        duration: 10.0,
        title: '🎯 Actionable Takeaways & Next Steps',
        virality_score: 78,
        score: 78,
        breakdown: {
          hook_score: 77.0,
          audio_energy_score: 79.0,
          visual_pacing_score: 76.0,
          topic_coherence_score: 80.0
        },
        reason:
          'Topic transition and clear vocal volume summary.',
        reasons: ['Topic transition', 'Clean sentence ending', 'Balanced audio volume'],
        transcript_snippet: 'Apply these three rules to your next video upload for instant results.',
        suggested_aspect_ratio: '9:16'
      }
    ];

    setSegments(demoSegments);
    setClips(demoClips);
    setSelectedClip(demoClips[0]);
    loadMetadata(demoId, demoClips[0].id);

    setStage('editor');
    setNotification({
      type: 'success',
      message: 'Sample video and AI highlights loaded into the studio!'
    });
  };

  const handleSelectClip = clip => {
    setSelectedClip(clip);
    setTrimStart(clip.start);
    setTrimEnd(clip.end);
    setCurrentTime(clip.start);
  };

  const handleReset = () => {
    setStage('ingest');
    setVideoId(null);
    setClips([]);
    setSelectedClip(null);
    setSegments([]);
    setMetadataSuite(null);
  };

  const handleUpdateSegment = (updatedSeg) => {
    setSegments(prevSegments =>
      prevSegments.map(s => (s.id === updatedSeg.id ? { ...s, ...updatedSeg } : s))
    );
    if (videoId && !videoId.startsWith('demo_')) {
      apiClient.updateCaptions(videoId, [updatedSeg]).catch(err => {
        console.warn('Could not sync caption edit to backend:', err);
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      <Header currentStage={stage} onReset={handleReset} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* STAGE 1: INGESTION */}
        {stage === 'ingest' && (
          <div className="max-w-4xl mx-auto space-y-8 py-6">
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Next-Gen Automated Content Repurposing</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
                Turn Long Videos Into{' '}
                <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Viral Shorts & Reels
                </span>
              </h1>
              <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto">
                Automatic Speech-to-Text, speaker diarization, scene boundary detection, and
                multimodal AI virality scoring with animated GSAP kinetic captions.
              </p>
            </div>

            {/* Unified Ingestion Flow: (a) Video Upload & (b) YouTube URL */}
            <IngestionFlow onSuccess={handleUploadSuccess} onDemoLoad={handleDemoLoad} />
          </div>
        )}

        {/* STAGE 2: PIPELINE PROCESSING */}
        {stage === 'pipeline' && (
          <div className="py-12">
            <PipelineStatus
              progress={pipelineProgress}
              onRetry={() => {
                if (videoId) apiClient.getPipelineStatus(videoId);
              }}
            />
          </div>
        )}

        {/* STAGE 3: INTERACTIVE STUDIO & EDITOR */}
        {stage === 'editor' && (
          <div className="space-y-6">
            {/* Studio Top Control Strip */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <Film className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white line-clamp-1">{videoTitle}</h2>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>{selectedClip?.title || 'Custom Clip'}</span>
                    <span>•</span>
                    <span className="font-mono text-indigo-400">
                      {(trimEnd - trimStart).toFixed(1)}s
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <AspectRatioSelector value={aspectRatio} onChange={setAspectRatio} />

                <button
                  onClick={() => setIsExportOpen(true)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Clip</span>
                </button>
              </div>
            </div>

            {/* Studio Grid: Canvas vs Inspector */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Video Canvas Preview */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center p-6 rounded-2xl bg-slate-900/40 border border-slate-800">
                <VideoPlayer
                  videoSrc={videoSrc}
                  currentTime={currentTime}
                  onTimeUpdate={setCurrentTime}
                  trimStart={trimStart}
                  trimEnd={trimEnd}
                  segments={segments}
                  onUpdateSegment={handleUpdateSegment}
                  captionConfig={captionConfig}
                  aspectRatio={aspectRatio}
                />
              </div>

              {/* Right Column: Tabbed Inspector */}
              <div className="lg:col-span-7 space-y-4">
                {/* Inspector Tabs */}
                <div className="flex items-center gap-2 p-1.5 bg-slate-900/80 border border-slate-800 rounded-xl">
                  <button
                    onClick={() => setActiveTab('highlights')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      activeTab === 'highlights'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5 text-rose-400" />
                    <span>AI Highlights ({clips.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('captions')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      activeTab === 'captions'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Type className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Kinetic Captions</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('metadata')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      activeTab === 'metadata'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span>YouTube SEO</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('transitions')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                      activeTab === 'transitions'
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Transitions</span>
                  </button>
                </div>

                {/* Tab Contents */}
                <div>
                  {activeTab === 'highlights' && (
                    <HighlightLeaderboard
                      clips={clips}
                      selectedClipId={selectedClip?.id}
                      onSelectClip={handleSelectClip}
                    />
                  )}

                  {activeTab === 'captions' && (
                    <CaptionCustomizer
                      config={captionConfig}
                      onChange={setCaptionConfig}
                      segments={segments}
                      onUpdateSegment={handleUpdateSegment}
                    />
                  )}

                  {activeTab === 'metadata' && (
                    <MetadataStudio
                      metadata={metadataSuite}
                      onRegenerate={() => loadMetadata(videoId, selectedClip?.id)}
                      isLoading={isMetadataLoading}
                    />
                  )}

                  {activeTab === 'transitions' && (
                    <TransitionPicker selected="fade" onSelect={() => {}} />
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Multi-Track Timeline */}
            <div>
              <Timeline
                totalDuration={totalDuration}
                currentTime={currentTime}
                trimStart={trimStart}
                trimEnd={trimEnd}
                onTrimChange={(start, end) => {
                  setTrimStart(start);
                  setTrimEnd(end);
                }}
                onSeek={time => setCurrentTime(time)}
                segments={segments}
              />
            </div>
          </div>
        )}
      </main>

      {/* Export Dialog */}
      <ExportDialog
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        videoId={videoId || 'demo'}
        clipId={selectedClip?.id || 'clip_1'}
        trimStart={trimStart}
        trimEnd={trimEnd}
        aspectRatio={aspectRatio}
        captionConfig={captionConfig}
      />

      {/* Global Toast Notification */}
      <NotificationToast notification={notification} onClose={() => setNotification(null)} />
    </div>
  );
}
