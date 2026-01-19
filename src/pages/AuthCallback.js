import React, { useEffect, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import axios from 'axios';
import { AuthContext } from '../state/AuthContext';
import { jwtDecode } from 'jwt-decode';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { dispatch } = useContext(AuthContext);

  useEffect(() => {
    const token = searchParams.get('token');

    if (token) {
      // トークンをlocalStorageに保存
      localStorage.setItem('token', token);

      // APIのデフォルトヘッダーにトークンを設定
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // ユーザー情報の取得（JWTデコードだけでなくサーバーから最新情報を取得）
      const fetchUser = async () => {
        try {
          const res = await axios.get('/api/users/me');
          // AuthContextにユーザー情報をディスパッチ
          dispatch({ type: "LOGIN_SUCCESS", payload: res.data });
          // ホームページへリダイレクト
          navigate('/');
        } catch (error) {
          console.error("Failed to fetch user after Google login:", error);
          // エラーの場合はデコードしたもので一旦凌ぐ（フォールバック）
          try {
            const decodedUser = jwtDecode(token);
            // jwtDecodeのpayloadは 'id' なので '_id' に変換して整合性を取る
            const fallbackUser = { ...decodedUser, _id: decodedUser.id };
            dispatch({ type: "LOGIN_SUCCESS", payload: fallbackUser });
            navigate('/');
          } catch (decodeErr) {
            navigate('/login');
          }
        }
      };

      fetchUser();
    } else {
      // エラーの場合はログインページへ
      navigate('/login');
    }
  }, [searchParams, navigate, dispatch]);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}
    >
      <CircularProgress />
    </Box>
  );
};

export default AuthCallback;