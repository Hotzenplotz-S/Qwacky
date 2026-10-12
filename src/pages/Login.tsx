import { useState, useRef, useEffect, useMemo } from 'react'
import { DuckService } from '../services/DuckService'
import { MdArrowBack } from 'react-icons/md'
import { useApp } from '../context/AppContext'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { BackButton, PrimaryButton } from '../styles/SharedStyles'
import { LoginContainer, LoginMessage, DuckText, InputWrapper, LoginInput, Suffix, LoginErrorMessage, SignupSection, SignupLink } from '../styles/pages.styles'

interface LoginProps {
  onSubmit: (username: string) => void;
  isAddingAccount?: boolean;
  onBack?: () => void;
}

export const Login = ({ onSubmit, isAddingAccount, onBack }: LoginProps) => {
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showSignupDialog, setShowSignupDialog] = useState(false)
  const duckService = useMemo(() => new DuckService(), [])
  const { accounts } = useApp()
  const checkClosedRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (checkClosedRef.current) clearInterval(checkClosedRef.current);
    };
  }, []);

  const sanitizeUsername = (input: string) => {
    return input.replace(/[^a-zA-Z0-9-_]/g, '');
  }

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitized = sanitizeUsername(e.target.value);
    setUsername(sanitized);
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const sanitized = sanitizeUsername(pastedText);
    setUsername(sanitized);
  }

  const openSignupWindow = () => {
    const isMobile = /android|mobile/i.test(navigator.userAgent);
    const signupUrl = 'https://duckduckgo.com/email/start';

    const signupWindow = isMobile
      ? window.open(signupUrl, '_blank')
      : window.open(
          signupUrl,
          'duckSignup',
          `width=480,height=720,left=${(screen.width - 480) / 2},top=${(screen.height - 720) / 2},scrollbars=yes,resizable=yes`
        );

    if (signupWindow) {
      checkClosedRef.current = setInterval(() => {
        if (signupWindow.closed) {
          clearInterval(checkClosedRef.current!);
          checkClosedRef.current = null;
        }
      }, 1000);
    }
  }

  const handleCreateAccount = () => {
    setShowSignupDialog(true);
  }

  const handleSignupConfirm = () => {
    setShowSignupDialog(false);
    chrome.storage.local.set({ awaiting_signup_auto_login: true });
    openSignupWindow();
  }

  const handleSubmit = async () => {
    setError('')
    setLoading(true)

    const cleanUsername = username.replace(/@duck\.com$/, '')

    if (accounts.some(acc => acc.username === cleanUsername)) {
      setLoading(false)
      setError('此账户已登录')
      return
    }

    const response = await duckService.login(cleanUsername)

    setLoading(false)
    if (response.status === 'success') {
      onSubmit(cleanUsername)
    } else {
      setError(response.message)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && username && !loading) {
      handleSubmit()
    }
  }

  return (
    <LoginContainer>
      {isAddingAccount && onBack && (
        <BackButton onClick={onBack}>
          <MdArrowBack size={20} />
          返回控制面板
        </BackButton>
      )}
      <LoginMessage>登录以管理你的 <DuckText>@duck.com</DuckText> 地址</LoginMessage>
      <InputWrapper>
        <LoginInput
          type="text"
          placeholder="输入 Duck 用户名"
          value={username}
          onChange={handleUsernameChange}
          onKeyUp={handleKeyPress}
          onPaste={handlePaste}
          disabled={loading}
          autoComplete="off"
          spellCheck={false}
        />
        <Suffix>@duck.com</Suffix>
      </InputWrapper>
      <PrimaryButton onClick={handleSubmit} disabled={!username || loading}>
        {loading ? '发送中……' : '继续'}
      </PrimaryButton>
      {error && <LoginErrorMessage>{error}</LoginErrorMessage>}

      <SignupSection>
        还没有账户？ <SignupLink onClick={handleCreateAccount}>立即创建</SignupLink>
      </SignupSection>

      <ConfirmDialog
        isOpen={showSignupDialog}
        variant="info"
        title="创建 Duck 地址"
        message="You'll be redirected to DuckDuckGo to create your @duck.com address. Once you complete the signup, you'll be automatically logged in."
        confirmLabel="继续前往 DuckDuckGo"
        cancelLabel="取消"
        onConfirm={handleSignupConfirm}
        onCancel={() => setShowSignupDialog(false)}
      />
    </LoginContainer>
  )
}
