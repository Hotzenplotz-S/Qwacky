import React, { useState, useEffect, useCallback, useRef } from 'react'
import { usePermissions, PERMISSIONS } from '../context/PermissionContext'
import { ConfirmDialog } from './ConfirmDialog'
import Markdown from 'react-markdown'
import {
  ToggleContainer,
  ToggleHeader,
  ToggleTitle,
  ToggleSwitch,
  ToggleInput,
  ToggleSlider,
  ToggleDescription,
  BrowserSpecificInfo,
  StatusMessage,
  InfoIcon,
  Tooltip,
  InfoIconContainer,
  LinkText,
  NoticeContainer,
  NoticeParagraph
} from '../styles/ui.styles'

declare const browser: typeof chrome
const api = typeof browser !== 'undefined' ? browser : chrome

const isFirefox = navigator.userAgent.toLowerCase().includes('firefox')

const CHROME_PERMISSION_NOTICE_SEEN = 'chromePermissionNoticeSeen'

interface PermissionToggleProps {
  name: string
  description: string
  isEnabled: boolean
  onChange: (enabled: boolean) => void
  disabled?: boolean
}

export const PermissionToggle: React.FC<PermissionToggleProps> = ({
  name,
  description,
  isEnabled,
  onChange,
  disabled = false
}) => {
  const [status, setStatus] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null)
  const [showPermissionsNotice, setShowPermissionsNotice] = useState(false)
  const [showChromeNotice, setShowChromeNotice] = useState(false)
  const [chromeNoticeSeen, setChromeNoticeSeen] = useState(false)
  const { requestPermissions, removePermissions, checkPermission } = usePermissions()
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const tooltipTimeoutRef = useRef<number | null>(null);
  const reloadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const permissionType = Object.entries(PERMISSIONS).find(
    ([_, permission]) => permission.name === name
  )?.[0] as keyof typeof PERMISSIONS | undefined;

  const isRequired = permissionType ? PERMISSIONS[permissionType]?.isRequired : false;

  const browserSpecificInfo = permissionType && PERMISSIONS[permissionType]?.browserSpecificInfo
    ? isFirefox
      ? PERMISSIONS[permissionType].browserSpecificInfo?.firefox
      : PERMISSIONS[permissionType].browserSpecificInfo?.chrome
    : undefined;

  const showTooltip = () => {
    if (tooltipTimeoutRef.current) {
      window.clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    setTooltipVisible(true);
  };

  const hideTooltip = () => {
    tooltipTimeoutRef.current = window.setTimeout(() => {
      setTooltipVisible(false);
    }, 2000);
  };

  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        window.clearTimeout(tooltipTimeoutRef.current);
      }
      if (reloadTimeoutRef.current) clearTimeout(reloadTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isFirefox) {
      const checkChromeNoticeSeen = async () => {
        try {
          const result = await api.storage.local.get(CHROME_PERMISSION_NOTICE_SEEN)
          setChromeNoticeSeen(Boolean(result[CHROME_PERMISSION_NOTICE_SEEN]))
        } catch (err) {
          console.error('Error checking Chrome notice status:', err)
        }
      }

      checkChromeNoticeSeen()
    }
  }, [])

  useEffect(() => {
    if (status) {
      const timer = setTimeout(() => setStatus(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [status])

  const handleNoticeDone = useCallback(async () => {
    setShowPermissionsNotice(false)
    try {
      await requestPermissions('contextMenuFeatures')
    } catch (error) {
      console.error('Error requesting permissions:', error)
    }
  }, [requestPermissions])

  const handleChromeNoticeDone = useCallback(async () => {
    setShowChromeNotice(false)
    try {
      await api.storage.local.set({ [CHROME_PERMISSION_NOTICE_SEEN]: true })
      setChromeNoticeSeen(true)

      await requestPermissions('contextMenuFeatures')
    } catch (error) {
      console.error('Error handling Chrome notice:', error)
    }
  }, [requestPermissions])

  const handleToggle = useCallback(async (newState: boolean) => {
    if (disabled || isRequired) return

    try {
      if (newState) {
        const hasPermission = await checkPermission('contextMenuFeatures')
        if (!hasPermission) {
          if (isFirefox) {
            setShowPermissionsNotice(true)
            return
          } else {
            if (!chromeNoticeSeen) {
              setShowChromeNotice(true)
              return
            }
            const granted = await requestPermissions('contextMenuFeatures')
            if (!granted) {
              setStatus({ message: '权限请求被拒绝', type: 'error' })
              onChange(false)
              return
            }
          }
        }
        const response = await api.runtime.sendMessage({
          action: 'toggleFeature',
          enabled: true
        })
        if (response?.success) {
          setStatus({ message: '正在重新加载以应用更改……', type: 'success' })
          onChange(true)

          if (reloadTimeoutRef.current) clearTimeout(reloadTimeoutRef.current)
          reloadTimeoutRef.current = setTimeout(() => {
            api.runtime.sendMessage({ action: 'reload-extension' })
          }, 1500)
        } else {
          setStatus({
            message: response?.reason === 'unsupported'
              ? '此浏览器不支持自动填充'
              : '启用功能失败',
            type: 'error'
          })
          onChange(false)
        }
      } else {
        setStatus({ message: `Disabling ${name}...`, type: 'info' })
        const response = await api.runtime.sendMessage({
          action: 'toggleFeature',
          enabled: false
        })
        if (response?.success) {
          setStatus({ message: '正在重新加载以应用更改……', type: 'success' })
          await removePermissions('contextMenuFeatures')
          onChange(false)

          if (reloadTimeoutRef.current) clearTimeout(reloadTimeoutRef.current)
          reloadTimeoutRef.current = setTimeout(() => {
            api.runtime.sendMessage({ action: 'reload-extension' })
          }, 1500)
        } else {
          setStatus({ message: '关闭功能失败', type: 'error' })
          onChange(true)
        }
      }
    } catch (error) {
      console.error('Toggle error:', error)
      setStatus({ message: '发生错误', type: 'error' })
      onChange(!newState)
    }
  }, [name, disabled, onChange, removePermissions, checkPermission, requestPermissions, chromeNoticeSeen, isRequired])

  const FirefoxPermissionNotice = () => (
    <NoticeContainer>
      <NoticeParagraph>启用此功能：</NoticeParagraph>
      <NoticeParagraph>1. Firefox will show a permissions request - click 'Allow'</NoticeParagraph>
      <NoticeParagraph>2. Return to the extension and toggle the feature again</NoticeParagraph>
      <NoticeParagraph>之后你可以随时关闭此功能。</NoticeParagraph>
    </NoticeContainer>
  );

  const ChromePermissionNotice = () => (
    <NoticeContainer>
      <NoticeParagraph>Chrome 与 Firefox 的权限处理方式不同。</NoticeParagraph>
      <NoticeParagraph>启用此功能时，Chrome 会显示一次权限请求。点击“完成”后，可能还会出现权限对话框。</NoticeParagraph>
      <NoticeParagraph>如果出现权限对话框，请点击“允许”，然后返回扩展再次开启此功能。</NoticeParagraph>
      <NoticeParagraph>详情请参阅： <LinkText
          href="https://github.com/Lanshuns/Qwacky/blob/main/PRIVACY.md#permissions"
          target="_blank"
          rel="noopener noreferrer"
        >
          浏览器特定的权限处理与限制
        </LinkText>
      </NoticeParagraph>
    </NoticeContainer>
  );

  return (
    <ToggleContainer disabled={disabled && !isRequired}>
      <ToggleHeader>
        <ToggleSwitch>
          <ToggleInput
            type="checkbox"
            checked={isEnabled}
            onChange={e => handleToggle(e.target.checked)}
            disabled={disabled || isRequired}
          />
          <ToggleSlider />
        </ToggleSwitch>
        <ToggleTitle>
          {name}
          {!isFirefox && name === "Autofill" && (
            <InfoIconContainer
              onMouseEnter={showTooltip}
              onMouseLeave={hideTooltip}
              onClick={showTooltip}
            >
              <InfoIcon size={16} />
              <Tooltip
                style={{
                  opacity: tooltipVisible ? 1 : 0,
                  visibility: tooltipVisible ? 'visible' : 'hidden'
                }}
                onMouseEnter={showTooltip}
                onMouseLeave={hideTooltip}
              >
                Browser additional permissions request will only appear once if not already granted.{' '}
                <LinkText
                  href="https://github.com/Lanshuns/Qwacky/blob/main/PRIVACY.md#permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Read More
                </LinkText>
              </Tooltip>
            </InfoIconContainer>
          )}
        </ToggleTitle>
      </ToggleHeader>
      <ToggleDescription>
        <Markdown>{description}</Markdown>
      </ToggleDescription>

      {browserSpecificInfo && (
        <BrowserSpecificInfo>
          <Markdown>{browserSpecificInfo}</Markdown>
        </BrowserSpecificInfo>
      )}

      {status && (
        <StatusMessage type={status.type}>
          {status.message}
        </StatusMessage>
      )}
      <ConfirmDialog
        isOpen={showPermissionsNotice}
        title="权限提示"
        message={<FirefoxPermissionNotice />}
        confirmLabel="完成"
        onConfirm={handleNoticeDone}
        singleButton={true}
        variant="info"
      />
      <ConfirmDialog
        isOpen={showChromeNotice}
        title="权限提示"
        message={<ChromePermissionNotice />}
        confirmLabel="完成"
        onConfirm={handleChromeNoticeDone}
        singleButton={true}
        variant="info"
      />
    </ToggleContainer>
  )
}
