import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { usePosts } from '../../hooks/usePosts';
import { AIWriter } from './AIWriter';
import { HashtagGenerator } from './HashtagGenerator';
import { Button } from '../common/Button';
import { Sparkles, Hash } from 'lucide-react';

const PLATFORMS = ['twitter', 'instagram', 'linkedin', 'facebook'];

interface FormData {
  content: string;
  platforms: string[];
  scheduledAt?: string;
}

export const ContentEditor = () => {
  const { createPost } = usePosts();
  const [showAI, setShowAI] = useState(false);
  const [showHashtags, setShowHashtags] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    defaultValues: { platforms: [] },
  });

  const content = watch('content', '');

  const onSubmit = async (data: FormData) => {
    setSubmitting(true);
    await createPost({ content: data.content, platforms: data.platforms, scheduled_at: data.scheduledAt, status: data.scheduledAt ? 'scheduled' : 'draft' });
    setSubmitting(false);
    setValue('content', '');
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Compose Post</h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <textarea
                {...register('content', { required: 'Content is required' })}
                rows={6}
                placeholder="What do you want to share?"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {errors.content && <p className="text-xs text-red-500 mt-1">{errors.content.message}</p>}
              <p className="text-right text-xs text-gray-400 mt-1">{content.length} chars</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Platforms</label>
              <div className="flex gap-2 flex-wrap">
                {PLATFORMS.map(p => (
                  <label key={p} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" value={p} {...register('platforms', { required: 'Select at least one platform' })} className="rounded text-indigo-600" />
                    <span className="text-sm capitalize text-gray-700">{p}</span>
                  </label>
                ))}
              </div>
              {errors.platforms && <p className="text-xs text-red-500 mt-1">{errors.platforms.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Schedule for (optional)</label>
              <input type="datetime-local" {...register('scheduledAt')} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>

            <div className="flex gap-2">
              <Button type="submit" loading={submitting}>Publish / Save</Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowAI(v => !v)}>
                <Sparkles className="mr-1 h-4 w-4" /> AI Write
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowHashtags(v => !v)}>
                <Hash className="mr-1 h-4 w-4" /> Hashtags
              </Button>
            </div>
          </form>
        </div>

        {showHashtags && (
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <HashtagGenerator content={content} onInsert={tags => setValue('content', content + ' ' + tags)} />
          </div>
        )}
      </div>

      {showAI && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="font-semibold text-gray-900 mb-4">AI Writer</h3>
          <AIWriter onInsert={text => { setValue('content', text); setShowAI(false); }} />
        </div>
      )}
    </div>
  );
};
