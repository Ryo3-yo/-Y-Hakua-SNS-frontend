import React, { useEffect, useState, useContext, useCallback } from 'react'
import './timeline.css'
import Share from '../share/share'
import Post from '../post/post'
import axios from 'axios'
import { AuthContext } from '../../state/AuthContext'
import { Refresh, School } from '@mui/icons-material' // School icon for Classroom

export default function Timeline({ username }) {
  const [posts, setPosts] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { user } = useContext(AuthContext);

  const [, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchPosts = useCallback(async (pageNum = 1, isRefresh = false) => {
    try {
      if (pageNum === 1) setIsRefreshing(true);
      else setIsLoadingMore(true);

      const response = username
        ? await axios.get(`/api/posts/profile/${username}?page=${pageNum}&limit=10`)
        : await axios.get(`/api/posts/timeline/all?page=${pageNum}&limit=10`);

      const newPosts = response.data;

      if (isRefresh || pageNum === 1) {
        setPosts(newPosts);
        setPage(1);
        setHasMore(newPosts.length === 10);
      } else {
        setPosts((prev) => [...prev, ...newPosts]);
        setHasMore(newPosts.length === 10);
      }
    } catch (err) {
      console.log(err);
    } finally {
      if (pageNum === 1) setTimeout(() => setIsRefreshing(false), 500);
      else setIsLoadingMore(false);
    }
  }, [username]);

  // Handle scroll for infinite loading
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop + 100 >=
        document.documentElement.offsetHeight
      ) {
        if (hasMore && !isLoadingMore && !isRefreshing) {
          setPage((prev) => {
            const nextPage = prev + 1;
            fetchPosts(nextPage);
            return nextPage;
          });
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasMore, isLoadingMore, isRefreshing, fetchPosts]);

  const handleClassroomSync = useCallback(async (isAuto = false) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        if (!isAuto) alert("Google Classroomと同期するには、Googleでのログインが必要です。");
        return;
      }

      setIsSyncing(true);
      const res = await axios.get('/api/classroom/announcements', {
        headers: { Authorization: `Bearer ${token}` }
      });

      // アナウンスメントをPostコンポーネントが扱える形式に変換
      const formattedAnnouncements = res.data.map(item => ({
        _id: item.id || item._id,
        desc: `${item.displayTitle}\n[Course: ${item.courseName}]\n\n${item.displayText || "No content"}`,
        img: null,
        createdAt: item.updateTime,
        userId: {
          username: "Google Classroom",
          profilePicture: "https://upload.wikimedia.org/wikipedia/commons/5/59/Google_Classroom_Logo.png", // 仮のアイコン
          _id: "google_classroom_bot"
        },
        likes: [],
        comment: 0,
        isClassroom: true,
        courseLink: item.alternateLink || item.courseLink,
        materials: item.materials || [] // マテリアルを追加
      }));

      setAnnouncements(formattedAnnouncements);
    } catch (err) {
      console.error("Classroom sync error full object:", err);
      // 自動同期の場合はアラートを出さない
      if (!isAuto) {
        const errorMsg = err.response?.data?.message || err.message || "Unknown error";
        if (err.response && err.response.status === 401) {
          alert(`Google認証の有効期限が切れている可能性があります。再ログインしてください。\n(${errorMsg})`);
        } else {
          alert(`Classroomデータの取得に失敗しました。\n理由: ${errorMsg}`);
        }
      }
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
    // タイムライン（ホーム）でのみ自動同期を実行
    if (!username) {
      handleClassroomSync(true);
    }
  }, [username, fetchPosts, handleClassroomSync]);

  const handleRefresh = () => {
    fetchPosts(1, true);
    if (!username) {
      handleClassroomSync(true);
    }
  };

  // 投稿とアナウンスメントを日付順にマージしてソート
  const getCombinedPosts = () => {
    // 全てを一つの配列にまとめ、日付の降順（新しい順）でソート
    const combined = [...posts, ...announcements].sort((a, b) => {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return combined;
  };

  const displayPosts = getCombinedPosts();

  return (
    <div className='timeline'>
      <div className="timelineWrapper">
        <div className="timelineHeader">
          <div className="timelineHeaderButtons">
            <div
              className={`refreshButton ${isRefreshing ? 'refreshing' : ''}`}
              onClick={handleRefresh}
              title="Refresh Timeline"
            >
              <Refresh className="refreshIcon" />
              <span className="refreshText">New Posts</span>
            </div>
            {/* Sync Button */}
            {!username && ( // プロフィールページ以外でのみ表示
              <div
                className={`refreshButton syncButton ${isSyncing ? 'syncing' : ''}`}
                onClick={handleClassroomSync}
                title="Sync with Google Classroom"
                style={{ marginLeft: '10px' }}
              >
                <School className="refreshIcon" />
                <span className="refreshText">Sync Class</span>
              </div>
            )}
          </div>
        </div>

        {user && (!username || username === user.username) && <Share className="Share" />}
        {displayPosts.map((post) => (
          <Post post={post} key={post.isClassroom ? post._id : (post._id + post.createdAt)} />
        ))}
        {isLoadingMore && <div className="loadingMore">読み込み中...</div>}
        {!hasMore && posts.length > 0 && <div className="noMorePosts">これ以上の投稿はありません。</div>}
      </div>
    </div>
  )
}
