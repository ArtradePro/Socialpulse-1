import { useState } from 'react';
import { aiService } from '../../services/aiService';
import { Hash } from 'lucide-react';
import { Button } from '../common/Button';

interface HashtagGeneratorProps {
  content: string;
  onInsert: (hashtags: string) => void;
}

export const HashtagGenerator = ({ content, onInsert }: HashtagGeneratorProps) => {
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const generate = async () => {
    if (!content.trim()) return;
    setLoading(true);
    try {
      const data = await aiService.generateHashtags(content);
      setHashtags(data.hashtags);
      setSelected(new Set(data.hashtags));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const toggle = (tag: string) => {
    const next = new Set(selected);
    next.has(tag) ? next.delete(tag) : next.add(tag);
    setSelected(next);
  };

  const insert = () => {
    const tags = Array.from(selected).map(t => `#${t}`).join(' ');
    onInsert(tags);
  };

  return (
    <div className="space-y-3">
      <Button variant="secondary" size="sm" onClick={generate} loading={loading} className="w-full">
        <Hash className="mr-2 h-4 w-4" /> Generate Hashtags
      </Button>
      {hashtags.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2">
            {hashtags.map(tag => (
              <button
                key={tag}
                onClick={() => toggle(tag)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selected.has(tag)
                    ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                #{tag}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={insert}>Add {selected.size} hashtags</Button>
        </>
      )}
    </div>
  );
};
