import React, { useState } from 'react';
import { supabase } from '../supabase';
import { Mail, Lock, AlertCircle, Loader2, CheckCircle2, Settings } from 'lucide-react';

export const Auth: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const validateEmail = (emailStr: string): boolean => {
    const cleanEmail = emailStr.trim().toLowerCase();
    return cleanEmail.endsWith('@properwell.com.cn') || cleanEmail.endsWith('@properwell.com.vn');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Vui lòng điền đầy đủ email và mật khẩu.');
      return;
    }

    if (isSignUp) {
      if (!validateEmail(trimmedEmail)) {
        setError('Chỉ chấp nhận tài khoản email thuộc tên miền Properwell (@properwell.com hoặc @properwell.com.vn).');
        return;
      }
      if (password.length < 6) {
        setError('Mật khẩu phải có ít nhất 6 ký tự.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Mật khẩu xác nhận không khớp.');
        return;
      }
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: trimmedEmail,
          password: password,
        });

        if (signUpErr) throw signUpErr;

        if (data.user) {
          // Check if email confirmation is required (identifiable if identities array is empty or if user is not yet fully active)
          const identities = data.user.identities || [];
          if (identities.length === 0) {
            setError('Email này đã được đăng ký trước đó. Vui lòng đăng nhập.');
          } else {
            setSuccess('Đăng ký thành công! Vui lòng kiểm tra email của bạn để xác nhận tài khoản trước khi đăng nhập.');
            // Clear inputs
            setEmail('');
            setPassword('');
            setConfirmPassword('');
          }
        }
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password: password,
        });

        if (signInErr) throw signInErr;
      }
    } catch (err: any) {
      console.error('Authentication error:', err);
      setError(err.message || 'Đã xảy ra lỗi không xác định.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="sb-mark auth-logo-mark">
            <Settings size={22} />
          </div>
          <div>
            <h1 className="auth-title">F26 Division</h1>
            <p className="auth-subtitle">Purchasing &amp; Production Portal</p>
          </div>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${!isSignUp ? 'active' : ''}`}
            onClick={() => {
              setIsSignUp(false);
              setError('');
              setSuccess('');
            }}
            disabled={loading}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            className={`auth-tab ${isSignUp ? 'active' : ''}`}
            onClick={() => {
              setIsSignUp(true);
              setError('');
              setSuccess('');
            }}
            disabled={loading}
          >
            Đăng ký
          </button>
        </div>

        {error && (
          <div className="auth-alert auth-alert-error">
            <AlertCircle size={16} className="auth-alert-icon" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="auth-alert auth-alert-success">
            <CheckCircle2 size={16} className="auth-alert-icon" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field-group">
            <label className="auth-label">Email tài khoản</label>
            <div className="auth-input-wrapper">
              <Mail size={14} className="auth-input-icon" />
              <input
                type="email"
                placeholder="name@properwell.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>
            {isSignUp && (
              <span className="auth-hint">Chỉ hỗ trợ @properwell.com &amp; @properwell.com.vn</span>
            )}
          </div>

          <div className="auth-field-group">
            <label className="auth-label">Mật khẩu</label>
            <div className="auth-input-wrapper">
              <Lock size={14} className="auth-input-icon" />
              <input
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          {isSignUp && (
            <div className="auth-field-group">
              <label className="auth-label">Xác nhận mật khẩu</label>
              <div className="auth-input-wrapper">
                <Lock size={14} className="auth-input-icon" />
                <input
                  type="password"
                  placeholder="••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>
          )}

          <button type="submit" className="btn btn-p auth-submit-btn" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="spinner animate-spin" size={14} />
                Đang xử lý...
              </>
            ) : isSignUp ? (
              'Đăng ký tài khoản'
            ) : (
              'Đăng nhập'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
