import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { MdFileUpload, MdArrowBack, MdDescription, MdSecurity, MdDownload, MdSync, MdRefresh, MdKeyboardArrowDown, MdPalette, MdLightMode, MdDarkMode, MdDevices } from "react-icons/md";
import { DuckService } from "../services/DuckService";
import { StorageService } from "../services/StorageService";
import { SyncService, SyncOptions } from "../services/SyncService";
import { ImportAddressesResult } from "../services/ImportExportService";
import { usePermissions, PERMISSIONS, ALL_PERMISSIONS } from "../context/PermissionContext";
import { contextMenusUnsupportedOnPlatform } from "../utils/platform";
import { useApp, ThemeMode } from "../context/AppContext";
import { BackupSummary, TimeFormat } from "../types";
import { PermissionToggle } from "../components/PermissionToggle";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Section, SectionHeader, BackButton } from "../styles/SharedStyles";
import { ToggleContainer, ToggleHeader, ToggleTitle, ToggleSwitch, ToggleInput, ToggleSlider, ToggleDescription } from "../styles/ui.styles";
import {
  SettingsContainer,
  SyncToggleSwitch,
  SyncToggleInput,
  SyncToggleSlider,
  SyncStatsContainer,
  SyncStatRow,
  SyncStatValue,
  RefreshIconButton,
  SyncOptionsContainer,
  SyncOptionsTitle,
  SyncOptionRow,
  SyncOptionHint,
  ThemeOptionLabel,
  ThemeOptionGroup,
  ThemeOptionButton,
  ExportButtonsContainer,
  BackupButton,
  HiddenFileInput,
  ExportOptionsContainer,
  ExportOptionsTitle,
  ExportOptionRow,
  ExportOptionHint,
  DropdownWrapper,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "../styles/pages.styles";

declare const browser: typeof chrome;
const api = typeof browser !== 'undefined' ? browser : chrome;
const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
const isFirefoxPopup = isFirefox && !window.location.search.includes('popout=1');

const describeAddressImport = (result: ImportAddressesResult): string => {
  if (!result.success) {
    return `导入失败： ${result.error || '未知错误'}`;
  }

  const notes: string[] = [];
  if (result.duplicates > 0) {
    notes.push(`${result.duplicates} duplicate${result.duplicates === 1 ? '' : 's'} skipped`);
  }
  if (result.invalid > 0) notes.push(`${result.invalid} ignored (not a duck.com address)`);

  if (result.count === 0) {
    return result.error || 'No new addresses to import.';
  }

  const plural = result.count === 1 ? 'address' : 'addresses';
  return notes.length > 0
    ? `Imported ${result.count} ${plural} — ${notes.join(', ')}`
    : `Imported ${result.count} ${plural}`;
};

const THEME_OPTIONS: Array<{ mode: ThemeMode; icon: typeof MdLightMode; label: string }> = [
  { mode: 'light', icon: MdLightMode, label: '浅色' },
  { mode: 'dark', icon: MdDarkMode, label: '深色' },
  { mode: 'system', icon: MdDevices, label: '跟随系统' },
];

interface SettingsProps {
  onBack?: () => void;
}

export const Settings = ({ onBack }: SettingsProps) => {
  const [importResult, setImportResult] = useState<string | null>(null);
  const { hasPermissions } = usePermissions();
  const { accounts, currentAccount, themeMode, setThemeMode } = useApp();
  const [permissionState, setPermissionState] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importingRef = useRef(false);
  const duckService = useMemo(() => new DuckService(), []);
  const storageService = useMemo(() => new StorageService(), []);
  const syncService = useMemo(() => new SyncService(), []);
  const [timeFormat, setTimeFormat] = useState<TimeFormat>('12h');
  const [neverSaveAddresses, setNeverSaveAddresses] = useState(false);
  const { compactMode, setCompactMode } = useApp();
  const [showStats, setShowStats] = useState(true);
  const [showLatest, setShowLatest] = useState(true);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [syncOptions, setSyncOptions] = useState<SyncOptions>({ enabled: false, addresses: true, reverseAliases: true, session: false, syncAccounts: [] });
  const [includeSession, setIncludeSession] = useState(false);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(() =>
    accounts.map(a => a.username)
  );
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [syncAccountDropdownOpen, setSyncAccountDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const syncDropdownRef = useRef<HTMLDivElement>(null);
  const [showExportWarning, setShowExportWarning] = useState(false);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [showPopoutPrompt, setShowPopoutPrompt] = useState(false);
  const [backupSummary, setBackupSummary] = useState<BackupSummary | null>(null);
  const [pendingImportData, setPendingImportData] = useState<string | null>(null);
  const [syncStats, setSyncStats] = useState<{
    lastSync: number | null;
    bytesInUse: number;
    quotaBytes: number;
    percentUsed: number;
  } | null>(null);

  useEffect(() => {
    storageService.getTimeFormat().then(setTimeFormat);
    storageService.getNeverSaveAddresses().then(setNeverSaveAddresses);
    storageService.getShowStats().then(setShowStats);
    storageService.getShowLatest().then(setShowLatest);
  }, [storageService]);

  const handleCompactModeChange = (enabled: boolean) => {
    setCompactMode(enabled);
  };

  const handleShowStatsChange = async (enabled: boolean) => {
    setShowStats(enabled);
    await storageService.setShowStats(enabled);
  };

  const handleShowLatestChange = async (enabled: boolean) => {
    setShowLatest(enabled);
    await storageService.setShowLatest(enabled);
  };

  const handleTimeFormatChange = async (use24h: boolean) => {
    const format: TimeFormat = use24h ? '24h' : '12h';
    setTimeFormat(format);
    await storageService.setTimeFormat(format);
  };

  const handleNeverSaveAddressesChange = async (enabled: boolean) => {
    setNeverSaveAddresses(enabled);
    await storageService.setNeverSaveAddresses(enabled);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAccountDropdownOpen(false);
      }
      if (syncDropdownRef.current && !syncDropdownRef.current.contains(e.target as Node)) {
        setSyncAccountDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleAccount = (username: string) => {
    setSelectedAccounts(prev =>
      prev.includes(username)
        ? prev.filter(u => u !== username)
        : [...prev, username]
    );
  };

  const getDropdownLabel = () => {
    if (selectedAccounts.length === 0) return '选择账户……';
    if (selectedAccounts.length === accounts.length) return '所有账户';
    if (selectedAccounts.length === 1) return `${selectedAccounts[0]}@duck.com`;
    return `${selectedAccounts.length} 个账户已选择`;
  };

  useEffect(() => {
    const loadPermissionStates = async () => {
      const states: Record<string, boolean> = {};

      states.storage = true;
      if (isFirefox) {
        states.contextMenu = true;
      }

      try {
        const response = await api.runtime.sendMessage({ action: 'getFeatureState' });
        states.contextMenuFeatures = response?.enabled ?? false;
      } catch (error) {
        states.contextMenuFeatures = false;
      }

      setPermissionState(states);
    };

    loadPermissionStates();

    const timerId = setTimeout(loadPermissionStates, 1500);
    return () => clearTimeout(timerId);
  }, [hasPermissions]);

  useEffect(() => {
    const loadSyncState = async () => {
      const options = await syncService.getSyncOptions();
      setSyncOptions(options);

      if (options.enabled) {
        const stats = await syncService.getSyncStats();
        setSyncStats(stats);
      }
    };

    const handleSyncMessage = (message: any) => {
      if (message.action === 'syncAutoDisabled') {
        setSyncOptions(prev => ({ ...prev, enabled: false }));
        setSyncStats(null);
        setImportResult('Sync was automatically disabled because storage quota was exceeded.');
      }
    };

    loadSyncState();
    chrome.runtime.onMessage.addListener(handleSyncMessage);
    return () => chrome.runtime.onMessage.removeListener(handleSyncMessage);
  }, []);

  const handleSyncToggle = async (enabled: boolean) => {
    try {
      setLoading(prev => ({ ...prev, sync: true }));

      if (enabled) {
        const result = await syncService.setSyncEnabled(true);

        if (result.success) {
          const options = await syncService.getSyncOptions();
          setSyncOptions(options);

          const stats = await syncService.getSyncStats();
          setSyncStats(stats);
        } else {
          await syncService.setSyncEnabled(false);
        }
      } else {
        await syncService.setSyncEnabled(false);
        setSyncOptions(prev => ({ ...prev, enabled: false }));
        setSyncStats(null);
      }
    } catch (error: any) {
      await syncService.setSyncEnabled(false);
      setSyncOptions(prev => ({ ...prev, enabled: false }));
    } finally {
      setLoading(prev => ({ ...prev, sync: false }));
    }
  };

  const handleSyncOptionChange = async (key: keyof SyncOptions, value: boolean) => {
    const updated = { ...syncOptions, [key]: value };
    setSyncOptions(updated);
    await syncService.setSyncOptions({ [key]: value });

    if (value && syncOptions.enabled) {
      await syncService.migrateToSync();
      const stats = await syncService.getSyncStats();
      setSyncStats(stats);
    }
  };

  const handleSyncAccountsChange = async (username: string) => {
    const current = syncOptions.syncAccounts.length === 0 ? accounts.map(a => a.username) : [...syncOptions.syncAccounts];
    const updated = current.includes(username)
      ? current.filter(u => u !== username)
      : [...current, username];
    const finalAccounts = updated.length === accounts.length ? [] : updated;
    setSyncOptions(prev => ({ ...prev, syncAccounts: finalAccounts }));
    await syncService.setSyncOptions({ syncAccounts: finalAccounts });
  };

  const getSyncAccountLabel = () => {
    if (syncOptions.syncAccounts.length === 0) return '所有账户';
    if (syncOptions.syncAccounts.length === 1) return `${syncOptions.syncAccounts[0]}@duck.com`;
    return `${syncOptions.syncAccounts.length} 个账户已选择`;
  };

  const isAccountSyncSelected = (username: string) => {
    return syncOptions.syncAccounts.length === 0 || syncOptions.syncAccounts.includes(username);
  };

  const handleRefreshSync = async () => {
    try {
      setLoading(prev => ({ ...prev, refreshSync: true }));

      const result = await syncService.pullFromSync();

      if (result.success) {
        const stats = await syncService.getSyncStats();
        setSyncStats(stats);

        window.dispatchEvent(new Event('addressesUpdated'));
      }
    } catch (error: any) {
      console.error('Sync refresh error:', error);
    } finally {
      setLoading(prev => ({ ...prev, refreshSync: false }));
    }
  };


  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      const contextMenuKey = 'contextMenuEnabled';
      if (changes[contextMenuKey]) {
        setPermissionState(prev => ({
          ...prev,
          contextMenuFeatures: changes[contextMenuKey].newValue
        }));
      }
    };

    try {
      api.storage.onChanged.addListener(handleStorageChange);
    } catch (error) {
      console.error("Error adding storage change listener:", error);
    }

    return () => {
      try {
        api.storage.onChanged.removeListener(handleStorageChange);
      } catch (error) {
        console.error("Error removing storage change listener:", error);
      }
    };
  }, []);

  const togglePermission = useCallback(async (permission: string, enabled: boolean) => {
    if (PERMISSIONS[permission as keyof typeof PERMISSIONS]?.isRequired) {
      return;
    }

    setLoading(prev => ({ ...prev, [permission]: true }));

    try {
      if (permission === 'contextMenuFeatures') {
        const response = await api.runtime.sendMessage({
          action: 'toggleFeature',
          enabled
        });

        if (response && response.success) {
          setPermissionState(prev => ({
            ...prev,
            [permission]: enabled
          }));
        }
      }
    } catch (error) {
      console.error('Toggle permission error:', error);
    } finally {
      setLoading(prev => ({ ...prev, [permission]: false }));
    }
  }, []);

  const buildSummaryMessage = (s: BackupSummary): React.ReactNode => {
    const lines: string[] = [];

    if (s.action === 'export') {
      lines.push(`账户： ${s.accounts.map(a => a.username + '@duck.com').join(', ')}`);
      lines.push(`地址： ${s.totalAddresses}`);
      lines.push(`发送地址： ${s.totalReverseAliases}`);
      if (s.includesSession) lines.push(`会话数据：已包含`);
    } else {
      if (s.newAccounts && s.newAccounts > 0) {
        lines.push(`新增账户： ${s.newAccounts}`);
      }
      for (const a of s.accounts) {
        const parts: string[] = [];
        if (a.addresses > 0) parts.push(`${a.addresses} 地址`);
        if (a.reverseAliases > 0) parts.push(`${a.reverseAliases} send 地址`);
        if (parts.length > 0) {
          lines.push(`${a.username}@duck.com: +${parts.join(', ')}`);
        }
      }
      if ((s.skippedAddresses || 0) > 0 || (s.skippedReverseAliases || 0) > 0) {
        const skipped: string[] = [];
        if (s.skippedAddresses) skipped.push(`${s.skippedAddresses} 地址`);
        if (s.skippedReverseAliases) skipped.push(`${s.skippedReverseAliases} send 地址`);
        lines.push(`已跳过（已存在）： ${skipped.join(', ')}`);
      }
      if (s.newAddresses === 0 && s.newReverseAliases === 0 && (!s.newAccounts || s.newAccounts === 0)) {
        lines.push('所有内容已经是最新状态。');
      }
      if (s.includesSession) lines.push(`会话数据：已恢复`);
    }

    return lines.join('\n');
  };

  const handleExport = async () => {
    if (includeSession) {
      setShowExportWarning(true);
      return;
    }
    await doExport();
  };

  const getDateString = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  const doExport = async () => {
    try {
      setLoading(prev => ({ ...prev, export: true }));

      const { data, summary } = await duckService.exportBackup(selectedAccounts, includeSession);
      const blob = new Blob([data], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      try {
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", url);
        downloadAnchorNode.setAttribute("download", `qwacky_backup_${getDateString()}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
      } finally {
        URL.revokeObjectURL(url);
      }
      setBackupSummary(summary);
    } catch (error) {
      console.error("导出备份失败:", error);
      setImportResult("导出备份失败");
    } finally {
      setLoading(prev => ({ ...prev, export: false }));
    }
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      await processImport(text);
    } catch (error) {
      setImportResult("导入失败，文件无效");
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const processImport = async (text: string) => {
    if (importingRef.current) return;
    importingRef.current = true;
    try {
      const parsed = JSON.parse(text);

      if (parsed.type === 'qwacky_backup') {
        if (parsed.session) {
          setPendingImportData(text);
          setShowImportConfirm(true);
          return;
        }

        setLoading(prev => ({ ...prev, import: true }));
        const result = await duckService.importBackup(text);
        if (result.success && result.summary) {
          setBackupSummary(result.summary);
        } else {
          setImportResult(`导入失败： ${result.error || '未知错误'}`);
        }
        setLoading(prev => ({ ...prev, import: false }));
        return;
      }

      if (parsed.addresses && Array.isArray(parsed.addresses)) {
        setLoading(prev => ({ ...prev, import: true }));
        const result = await duckService.importAddresses(text);
        setImportResult(describeAddressImport(result));
        setLoading(prev => ({ ...prev, import: false }));
        return;
      }

      setImportResult("无法识别的文件格式");
    } catch {
      setLoading(prev => ({ ...prev, import: true }));
      const result = await duckService.importAddressList(text);
      setImportResult(describeAddressImport(result));
      setLoading(prev => ({ ...prev, import: false }));
    } finally {
      importingRef.current = false;
    }
  };

  const handleImportConfirmed = async () => {
    setShowImportConfirm(false);
    if (!pendingImportData) return;

    try {
      setLoading(prev => ({ ...prev, import: true }));
      const result = await duckService.importBackup(pendingImportData);

      if (result.success && result.summary) {
        setBackupSummary(result.summary);
      } else if (!result.success) {
        setImportResult(`导入失败： ${result.error || '未知错误'}`);
      }
    } catch (error) {
      setImportResult("导入失败");
    } finally {
      setPendingImportData(null);
      setLoading(prev => ({ ...prev, import: false }));
    }
  };

  const handlePaste = async (e: ClipboardEvent) => {
    e.preventDefault();

    const items = Array.from(e.clipboardData?.items || []);
    let text = '';

    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file?.name.match(/\.json$/i)) {
          try {
            text = await file.text();
            break;
          } catch (error) {
            console.error('Error reading file:', error);
          }
        }
      }
    }

    if (!text) {
      text = e.clipboardData?.getData('text/plain') || '';
    }

    if (!text) {
      return;
    }

    await processImport(text);
  };

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, []);

  return (
    <SettingsContainer>
      {onBack && (
        <BackButton onClick={onBack}>
          <MdArrowBack size={20} />
          Back to Dashboard
        </BackButton>
      )}
      <Section>
        <SectionHeader>
          <h2><MdPalette size={20} style={{ marginRight: '8px' }} />外观</h2>
        </SectionHeader>
        <ThemeOptionLabel>主题</ThemeOptionLabel>
        <ThemeOptionGroup>
          {THEME_OPTIONS.map(({ mode, icon: Icon, label }) => (
            <ThemeOptionButton
              key={mode}
              type="button"
              active={themeMode === mode}
              aria-pressed={themeMode === mode}
              onClick={() => setThemeMode(mode)}
            >
              <Icon size={16} />
              {label}
            </ThemeOptionButton>
          ))}
        </ThemeOptionGroup>
        <SyncOptionRow>
          <SyncToggleSwitch>
            <SyncToggleInput
              type="checkbox"
              checked={timeFormat === '24h'}
              onChange={(e) => handleTimeFormatChange(e.target.checked)}
            />
            <SyncToggleSlider />
          </SyncToggleSwitch>
          24 小时制
        </SyncOptionRow>
        <SyncOptionRow>
          <SyncToggleSwitch>
            <SyncToggleInput
              type="checkbox"
              checked={compactMode}
              onChange={(e) => handleCompactModeChange(e.target.checked)}
            />
            <SyncToggleSlider />
          </SyncToggleSwitch>
          紧凑模式
        </SyncOptionRow>
        <SyncOptionRow>
          <SyncToggleSwitch>
            <SyncToggleInput
              type="checkbox"
              checked={showStats}
              onChange={(e) => handleShowStatsChange(e.target.checked)}
            />
            <SyncToggleSlider />
          </SyncToggleSwitch>
          在首页显示统计数据
        </SyncOptionRow>
        <SyncOptionRow>
          <SyncToggleSwitch>
            <SyncToggleInput
              type="checkbox"
              checked={showLatest}
              onChange={(e) => handleShowLatestChange(e.target.checked)}
            />
            <SyncToggleSlider />
          </SyncToggleSwitch>
          在首页显示最新地址
        </SyncOptionRow>
      </Section>

      <Section>
        <SectionHeader>
          <h2><MdSecurity size={20} style={{ marginRight: '8px' }} />权限与功能</h2>
        </SectionHeader>
        {ALL_PERMISSIONS.map(permission => (
          <PermissionToggle
            key={permission}
            name={PERMISSIONS[permission].name}
            description={PERMISSIONS[permission].description}
            isEnabled={permission === 'storage' || permission === 'contextMenu'
              ? true
              : !contextMenusUnsupportedOnPlatform && (permissionState[permission] || false)}
            onChange={(enabled) => togglePermission(permission, enabled)}
            disabled={permission === 'contextMenuFeatures' && contextMenusUnsupportedOnPlatform}
          />
        ))}
        <ToggleContainer>
          <ToggleHeader>
            <ToggleSwitch>
              <ToggleInput
                type="checkbox"
                checked={!neverSaveAddresses}
                onChange={(e) => handleNeverSaveAddressesChange(!e.target.checked)}
              />
              <ToggleSlider />
            </ToggleSwitch>
            <ToggleTitle>历史记录</ToggleTitle>
          </ToggleHeader>
          <ToggleDescription>
            保存你生成的地址和转换过的收件人列表。关闭此项后，新地址只会复制到剪贴板，不会保存任何内容。
          </ToggleDescription>
        </ToggleContainer>
      </Section>

      <Section>
        <SectionHeader>
          <h2>
            <MdSync size={20} style={{ marginRight: '8px' }} />
            同步
          </h2>
        </SectionHeader>
        <SyncOptionRow style={{ marginBottom: syncOptions.enabled ? '12px' : 0 }}>
          <SyncToggleSwitch>
            <SyncToggleInput
              type="checkbox"
              checked={syncOptions.enabled}
              onChange={(e) => handleSyncToggle(e.target.checked)}
              disabled={loading.sync}
            />
            <SyncToggleSlider />
          </SyncToggleSwitch>
          跨设备同步
        </SyncOptionRow>

        {syncOptions.enabled && (
          <>
            {accounts.length > 1 && (
              <DropdownWrapper ref={syncDropdownRef} style={{ marginBottom: '12px' }}>
                <DropdownTrigger
                  type="button"
                  onClick={() => setSyncAccountDropdownOpen(prev => !prev)}
                  data-open={syncAccountDropdownOpen}
                >
                  {getSyncAccountLabel()}
                  <MdKeyboardArrowDown size={20} />
                </DropdownTrigger>
                {syncAccountDropdownOpen && (
                  <DropdownMenu>
                    {accounts.map(account => (
                      <DropdownItem key={account.username}>
                        <input
                          type="checkbox"
                          checked={isAccountSyncSelected(account.username)}
                          onChange={() => handleSyncAccountsChange(account.username)}
                        />
                        {account.username}@duck.com
                        {account.username === currentAccount && (
                          <SyncOptionHint>（当前）</SyncOptionHint>
                        )}
                      </DropdownItem>
                    ))}
                  </DropdownMenu>
                )}
              </DropdownWrapper>
            )}

            <SyncOptionsContainer>
              <SyncOptionsTitle>同步选项</SyncOptionsTitle>
              <SyncOptionRow>
                <SyncToggleSwitch>
                  <SyncToggleInput
                    type="checkbox"
                    checked={syncOptions.addresses}
                    onChange={(e) => handleSyncOptionChange('addresses', e.target.checked)}
                  />
                  <SyncToggleSlider />
                </SyncToggleSwitch>
                地址
              </SyncOptionRow>
              <SyncOptionRow>
                <SyncToggleSwitch>
                  <SyncToggleInput
                    type="checkbox"
                    checked={syncOptions.reverseAliases}
                    onChange={(e) => handleSyncOptionChange('reverseAliases', e.target.checked)}
                  />
                  <SyncToggleSlider />
                </SyncToggleSwitch>
                发送地址
              </SyncOptionRow>
              <SyncOptionRow>
                <SyncToggleSwitch>
                  <SyncToggleInput
                    type="checkbox"
                    checked={syncOptions.session}
                    onChange={(e) => handleSyncOptionChange('session', e.target.checked)}
                  />
                  <SyncToggleSlider />
                </SyncToggleSwitch>
                会话数据
                <SyncOptionHint>（登录数据和设置）</SyncOptionHint>
              </SyncOptionRow>
              {syncOptions.session && (
                <div style={{ marginLeft: '56px', marginTop: '4px', fontSize: '12px', color: '#ff9f19' }}>
                  {isFirefox
                    ? '会话数据包含你的访问令牌。同步时 Firefox 会对其加密，但数据仍存储在你的 Mozilla 账户中。'
                    : '会话数据包含你的访问令牌。同步时 Chrome 会对其加密，但数据仍存储在你的 Google 账户中。'}
                </div>
              )}
            </SyncOptionsContainer>

            {syncStats && (
              <SyncStatsContainer>
                <SyncStatRow>
                  <div>
                    <strong>状态：</strong> {syncStats.lastSync ? `上次同步：${new Date(syncStats.lastSync).toLocaleString()}` : '从未同步'}
                  </div>
                  <SyncStatValue>
                    <RefreshIconButton
                      onClick={handleRefreshSync}
                      disabled={loading.refreshSync}
                      title="刷新"
                    >
                      <MdRefresh size={16} />
                    </RefreshIconButton>
                  </SyncStatValue>
                </SyncStatRow>
                <SyncStatRow>
                  <div>
                    <strong>已用存储空间：</strong> {(syncStats.bytesInUse / 1024).toFixed(2)} KB / {(syncStats.quotaBytes / 1024).toFixed(0)} KB ({syncStats.percentUsed.toFixed(1)}%)
                  </div>
                </SyncStatRow>
              </SyncStatsContainer>
            )}
          </>
        )}
      </Section>

      <Section>
        <SectionHeader>
          <h2><MdDescription size={20} style={{ marginRight: '8px' }} />备份与恢复</h2>
        </SectionHeader>

        <ExportButtonsContainer>
          <BackupButton
            onClick={handleExport}
            disabled={loading.export || selectedAccounts.length === 0}
          >
            <MdDownload size={20} />
            {loading.export ? '导出中……' : '导出备份'}
          </BackupButton>
          <BackupButton
            onClick={isFirefoxPopup ? () => setShowPopoutPrompt(true) : handleImportClick}
            disabled={loading.import}
          >
            <MdFileUpload size={20} />
            {loading.import ? '导入中……' : '导入备份'}
          </BackupButton>
        </ExportButtonsContainer>

        <ExportOptionHint style={{ display: 'block', marginBottom: '16px' }}>
          Import accepts a Qwacky backup (.json), or a plain .txt list of existing
          duck.com addresses — one per line.
        </ExportOptionHint>

        <ExportOptionsContainer>
          <ExportOptionsTitle>导出选项</ExportOptionsTitle>

          {accounts.length > 1 && (
            <DropdownWrapper ref={dropdownRef}>
              <DropdownTrigger
                type="button"
                onClick={() => setAccountDropdownOpen(prev => !prev)}
                data-open={accountDropdownOpen}
              >
                {getDropdownLabel()}
                <MdKeyboardArrowDown size={20} />
              </DropdownTrigger>
              {accountDropdownOpen && (
                <DropdownMenu>
                  {accounts.map(account => (
                    <DropdownItem key={account.username}>
                      <input
                        type="checkbox"
                        checked={selectedAccounts.includes(account.username)}
                        onChange={() => toggleAccount(account.username)}
                      />
                      {account.username}@duck.com
                      {account.username === currentAccount && (
                        <ExportOptionHint>（当前）</ExportOptionHint>
                      )}
                    </DropdownItem>
                  ))}
                </DropdownMenu>
              )}
            </DropdownWrapper>
          )}

          <ExportOptionRow>
            <SyncToggleSwitch>
              <SyncToggleInput
                type="checkbox"
                checked={includeSession}
                onChange={(e) => setIncludeSession(e.target.checked)}
              />
              <SyncToggleSlider />
            </SyncToggleSwitch>
            Include session
            <ExportOptionHint>（登录数据和设置）</ExportOptionHint>
          </ExportOptionRow>
        </ExportOptionsContainer>

        {importResult && (
          <div style={{ marginTop: '16px', fontSize: '14px' }}>
            {importResult}
          </div>
        )}
        <HiddenFileInput
          type="file"
          ref={fileInputRef}
          accept=".json,.txt"
          onChange={handleImportFile}
        />
      </Section>

      <ConfirmDialog
        isOpen={showPopoutPrompt}
        variant="info"
        title="在新窗口中打开"
        message="Firefox 不允许从弹窗中选择文件。扩展会在新窗口中打开，你可以在那里正常导入备份。"
        confirmLabel="打开窗口"
        cancelLabel="取消"
        onConfirm={() => {
          setShowPopoutPrompt(false);
          chrome.runtime.sendMessage({ action: 'popoutExtension' });
          window.close();
        }}
        onCancel={() => setShowPopoutPrompt(false)}
      />

      <ConfirmDialog
        isOpen={showExportWarning}
        variant="warning"
        title="安全警告"
        message="The exported file will contain your access token and login credentials. Keep this file secure and do not share it. Anyone with this file can access your DuckDuckGo Email account."
        confirmLabel="仍然导出"
        cancelLabel="取消"
        onConfirm={() => {
          setShowExportWarning(false);
          doExport();
        }}
        onCancel={() => setShowExportWarning(false)}
      />

      <ConfirmDialog
        isOpen={showImportConfirm}
        variant="warning"
        title="导入备份"
        message="此备份包含会话数据。导入后，账户及其数据将添加到扩展中。确定要继续吗？"
        confirmLabel="导入"
        cancelLabel="取消"
        onConfirm={handleImportConfirmed}
        onCancel={() => {
          setShowImportConfirm(false);
          setPendingImportData(null);
        }}
      />

      <ConfirmDialog
        isOpen={backupSummary !== null}
        variant="info"
        title={backupSummary?.action === 'export' ? '导出完成' : '导入完成'}
        message={backupSummary ? buildSummaryMessage(backupSummary) : ''}
        confirmLabel="关闭"
        singleButton
        onConfirm={async () => {
          const isImport = backupSummary?.action === 'import';
          setBackupSummary(null);
          if (isImport) {
            await chrome.storage.local.set({ showSettings: false });
            window.location.reload();
          }
        }}
      />
    </SettingsContainer>
  );
};
