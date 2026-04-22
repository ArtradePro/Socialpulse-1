import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../store/store';
import { fetchPosts, createPost, deletePost } from '../store/postsSlice';

export const usePosts = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { items, loading, error, total, page } = useSelector((s: RootState) => s.posts);

  return {
    posts: items,
    loading,
    error,
    total,
    page,
    fetchPosts: (params?: { page?: number; limit?: number }) => dispatch(fetchPosts(params || {})),
    createPost: (data: Parameters<typeof createPost>[0]) => dispatch(createPost(data)),
    deletePost: (id: string) => dispatch(deletePost(id)),
  };
};
