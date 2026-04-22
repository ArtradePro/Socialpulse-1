import { useState } from 'react';
import { aiService } from '../../services/aiService';
import { Button } from '../common/Button';
import { Sparkles } from 'lucide-react';

interface AIWriterProps {
  onInsert: (content: string) => void;
}

const platforms = ['twitter', 'instagram', 'linkedin', 'facebook'];
const tones = ['professional', 'casual', 'humorous', 'inspirational'];

export const AIWriter = ({ onInsert }: AIWriterProps) => {
  const [topic, setTopic] = useState('');
  const [platform, setPlatform] = useState('');
  const [tone, setTone] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await aiService.generateContent(topic, tone || undefined, platform || undefined);
      setResult(data.content);
    } catch {
      setError('Failed to generate content');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Topic or idea</label>
        <input
          type="text"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="e.g. Product launch announcement"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
          <select value={platform} onChange={e => setPlatform(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="">Any</option>
            {platforms.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
          <select value={tone} onChange={e => setTone(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            <option value="">Default</option>
            {tones.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <Button onClick={generate} loading={loading} className="w-full">
        <Sparkles className="mr-2 h-4 w-4" /> Generate with AI
      </Button>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {result && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm text-gray-800 whitespace-pre-wrap">{result}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => onInsert(result)}>
            Insert into editor
          </Button>
        </div>
      )}
    </div>
  );
};
