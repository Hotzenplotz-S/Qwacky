import { useState, useEffect, useCallback, useMemo } from "react";
import { MdInfo, MdOpenInNew, MdKeyboardArrowDown, MdClose, MdCheck } from "react-icons/md";
import { useApp } from "../context/AppContext";
import { DuckService } from "../services/DuckService";
import { StorageService } from "../services/StorageService";
import { ReverseAlias, TimeFormat, AddressSource } from "../types";
import { useNotification } from "../components/Notification";

import { ItemListSection, ListItem, ListConfig } from "../components/AddressListSection";
import { DashboardTabs, DashboardTab } from "../components/DashboardTabs";
import { HomeStats } from "../components/HomeStats";
import { compareTags } from "../utils/tags";
import { DialogOverlay } from "../styles/ui.styles";
import {
  DashboardContainer,
  GenerateButton,
  HistoryNotice,
  ReverseAliasSection,
  ReverseAliasSteps,
  ReverseAliasInputRow,
  ReverseAliasInput,
  ReverseAliasConvertButton,
  InstructionsToggle,
  LearnMoreLink,
  SenderSelector,
  PickerContainer,
  PickerHeader,
  PickerSearchInput,
  PickerList,
  PickerItem,
  PickerItemText,
  PickerItemLabel,
} from "../styles/pages.styles";

interface StoredAddress {
  value: string;
  timestamp: number;
  notes?: string;
  tags?: string[];
  source?: AddressSource;
}

const GENERATE_LIST_CONFIG: ListConfig = {
  title: "地址历史",
  itemsLabel: "地址",
  emptyTitle: "暂无地址",
  emptySubtitle: "请从“首页”生成你的第一个地址",
  searchPlaceholder: "搜索地址或备注……",
  deleteTitle: "删除地址",
  getDeleteMessage: (key) => `确定要删除此地址吗？\n（${key}@duck.com）`,
  clearTitle: "清除所有地址",
  clearMessage: "确定要清除所有地址吗？\n\n此操作无法撤销。",
  hideStorageKey: "hide_generated_addresses",
};

const SEND_LIST_CONFIG: ListConfig = {
  title: "发送历史",
  itemsLabel: "发送地址",
  emptyTitle: "暂无历史记录",
  emptySubtitle: "请在上方转换收件人邮箱以开始使用",
  searchPlaceholder: "搜索邮箱或备注……",
  deleteTitle: "删除发送地址",
  getDeleteMessage: (key) => `确定要删除此收件人的发送地址吗？\n${key}？`,
  clearTitle: "清除所有历史记录",
  clearMessage: "确定要清除所有发送历史吗？\n\n此操作无法撤销。",
  hideStorageKey: "hide_reverse_aliases",
};

export const Dashboard = () => {
  const { userData, currentAccount } = useApp();
  const [addresses, setAddresses] = useState<StoredAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoEditAlias, setAutoEditAlias] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>('home');
  const [recipientEmail, setRecipientEmail] = useState("");
  const [reverseAliases, setReverseAliases] = useState<ReverseAlias[]>([]);
  const [showInstructions, setShowInstructions] = useState(false);
  const [selectedSender, setSelectedSender] = useState<string | null>(null);
  const [showAliasPicker, setShowAliasPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [neverSaveAddresses, setNeverSaveAddresses] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [showLatest, setShowLatest] = useState(true);
  const duckService = useMemo(() => new DuckService(), []);
  const storageService = useMemo(() => new StorageService(), []);
  const [timeFormat, setTimeFormat] = useState<TimeFormat>('12h');
  const { showNotification, NotificationRenderer } = useNotification();

  useEffect(() => {
    chrome.storage.local.get('dashboardActiveTab', (result) => {
      if (chrome.runtime.lastError) return;
      const saved = result.dashboardActiveTab === 'generate' ? 'home' : result.dashboardActiveTab;
      if (saved === 'home' || saved === 'addresses' || saved === 'send') {
        setActiveTab(saved);
      }
    });
  }, []);

  useEffect(() => {
    chrome.storage.local.set({ dashboardActiveTab: activeTab });
  }, [activeTab]);

  useEffect(() => {
    storageService.getTimeFormat().then(setTimeFormat);
    storageService.getNeverSaveAddresses().then(setNeverSaveAddresses);
    storageService.getShowStats().then(setShowStats);
    storageService.getShowLatest().then(setShowLatest);
  }, [storageService]);

  useEffect(() => {
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName !== 'local') return;
      if (changes.never_save_addresses) setNeverSaveAddresses(!!changes.never_save_addresses.newValue);
      if (changes.show_stats) setShowStats(changes.show_stats.newValue !== false);
      if (changes.show_latest) setShowLatest(changes.show_latest.newValue !== false);
      if (changes.time_format) setTimeFormat(changes.time_format.newValue === '24h' ? '24h' : '12h');
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  useEffect(() => {
    if (userData) {
      const loadData = async () => {
        try {
          const [loadedAddresses, loadedAliases] = await Promise.all([
            duckService.getAddresses(),
            duckService.getReverseAliases()
          ]);
          setAddresses(loadedAddresses);
          setReverseAliases(loadedAliases);
        } catch (error) {
          console.error('Error loading data:', error);
          showNotification("加载数据失败");
          setAddresses([]);
          setReverseAliases([]);
        }
      };

      loadData();
    } else {
      setAddresses([]);
      setReverseAliases([]);
    }
  }, [userData, currentAccount]);

  const copyToClipboard = useCallback(async (text: string, event?: MouseEvent) => {
    try {
      await navigator.clipboard.writeText(text);
      showNotification("已复制！", event);
    } catch {
      showNotification("复制失败", event);
    }
  }, [showNotification]);

  const formatTime = useCallback((timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString("zh-CN", {
      hour: "numeric",
      minute: "numeric",
      hour12: timeFormat === '12h',
      month: "short",
      day: "numeric",
    });
  }, [timeFormat]);

  const generateNewAddress = async () => {
    setLoading(true);
    try {
      const response = await duckService.generateAddress(undefined, 'popup');

      if (response.status === "success" && response.address) {
        if (!neverSaveAddresses) {
          const newAddress = {
            value: response.address,
            timestamp: Date.now(),
            notes: ''
          };
          setAddresses([newAddress, ...addresses]);
        }
        copyToClipboard(response.address + "@duck.com");
      } else {
        showNotification(response.message || "生成地址失败");
      }
    } catch (error) {
      console.error("Error generating address:", error);
      showNotification("生成地址失败");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAddressNotes = async (key: string, notes: string) => {
    const success = await duckService.updateAddressNotes(key, notes);
    if (success) {
      setAddresses(prev => prev.map(addr =>
        addr.value === key ? { ...addr, notes } : addr
      ));
    }
  };

  const handleDeleteAddress = async (key: string) => {
    const success = await duckService.deleteAddress(key);
    if (success) {
      setAddresses(prev => prev.filter(addr => addr.value !== key));
    }
  };

  const handleUpdateAddressTags = async (key: string, tags: string[]) => {
    const success = await duckService.updateAddressTags(key, tags);
    if (success) {
      setAddresses(prev => prev.map(addr =>
        addr.value === key ? { ...addr, tags } : addr
      ));
    }
  };

  const handleClearAllAddresses = async () => {
    const success = await duckService.clearAllAddresses();
    if (success) {
      setAddresses([]);
    }
  };

  const effectiveSender = useMemo(() => {
    if (selectedSender && addresses.some(a => a.value === selectedSender)) {
      return selectedSender;
    }
    return null;
  }, [selectedSender, addresses]);

  const filteredPickerAddresses = useMemo(() => {
    if (!pickerSearch.trim()) return addresses;
    const q = pickerSearch.toLowerCase();
    return addresses.filter(a =>
      a.value.toLowerCase().includes(q) ||
      (a.notes && a.notes.toLowerCase().includes(q))
    );
  }, [addresses, pickerSearch]);

  const handleConvertReverseAlias = async (event?: React.MouseEvent | React.KeyboardEvent) => {
    const email = recipientEmail.trim();
    if (!email || !email.includes("@") || !email.includes(".")) return;
    if (!userData) return;
    const senderLocal = effectiveSender || userData.user.username;
    const alias = email.replace("@", "_at_") + "_" + senderLocal + "@duck.com";

    await duckService.saveReverseAlias(email, alias);

    if (!neverSaveAddresses) {
      setReverseAliases(prev => {
        const existingIndex = prev.findIndex(a => a.recipientEmail === email);
        if (existingIndex !== -1) {
          const item = { ...prev[existingIndex], alias, timestamp: Date.now() };
          return [item, ...prev.filter((_, i) => i !== existingIndex)];
        }
        return [{
          recipientEmail: email,
          alias,
          timestamp: Date.now(),
          notes: '',
          username: senderLocal
        }, ...prev];
      });
    }

    try { await navigator.clipboard.writeText(alias); } catch {}
    const nativeEvent = event && 'clientX' in event.nativeEvent ? event.nativeEvent as MouseEvent : undefined;
    showNotification("已复制！", nativeEvent);
    setRecipientEmail("");
    setAutoEditAlias(email);
  };

  const handleUpdateReverseAliasNotes = async (key: string, notes: string) => {
    const success = await duckService.updateReverseAliasNotes(key, notes);
    if (success) {
      setReverseAliases(prev => prev.map(a =>
        a.recipientEmail === key ? { ...a, notes } : a
      ));
    }
  };

  const handleDeleteReverseAlias = async (key: string) => {
    const success = await duckService.deleteReverseAlias(key);
    if (success) {
      setReverseAliases(prev => prev.filter(a => a.recipientEmail !== key));
    }
  };

  const handleUpdateReverseAliasTags = async (key: string, tags: string[]) => {
    const success = await duckService.updateReverseAliasTags(key, tags);
    if (success) {
      setReverseAliases(prev => prev.map(a =>
        a.recipientEmail === key ? { ...a, tags } : a
      ));
    }
  };

  const handleClearAllReverseAliases = async () => {
    const success = await duckService.clearAllReverseAliases();
    if (success) {
      setReverseAliases([]);
    }
  };

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    addresses.forEach(addr => (addr.tags || []).forEach(t => tagSet.add(t)));
    reverseAliases.forEach(a => (a.tags || []).forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort(compareTags);
  }, [addresses, reverseAliases]);

  const addressItems: ListItem[] = useMemo(() =>
    addresses.map(addr => ({
      key: addr.value,
      primaryText: addr.value + "@duck.com",
      copyText: addr.value + "@duck.com",
      copyLabel: `Copy ${addr.value}@duck.com`,
      timestamp: addr.timestamp,
      notes: addr.notes,
      tags: addr.tags || [],
    })),
    [addresses]
  );

  const reverseAliasItems: ListItem[] = useMemo(() =>
    reverseAliases.map(a => ({
      key: a.recipientEmail,
      primaryText: a.recipientEmail,
      secondaryText: a.alias,
      copyText: a.alias,
      copyLabel: `Copy send address for ${a.recipientEmail}`,
      timestamp: a.timestamp,
      notes: a.notes,
      tags: a.tags || [],
    })),
    [reverseAliases]
  );

  if (!userData) return null;

  return (
    <DashboardContainer>
      <DashboardTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'home' && (
        <>
          <GenerateButton onClick={generateNewAddress} disabled={loading}>
            {loading ? "生成中……" : "生成新地址"}
          </GenerateButton>
          {neverSaveAddresses && (
            <HistoryNotice>
              <MdInfo size={14} />
              New addresses are copied but not saved
            </HistoryNotice>
          )}
          <HomeStats
            addresses={addresses}
            aliases={reverseAliases}
            accountTotal={userData.stats?.addresses_generated}
            copyToClipboard={copyToClipboard}
            formatTime={formatTime}
            showStats={showStats}
            showLatest={showLatest}
          />
        </>
      )}

      {activeTab === 'addresses' && (
        <>
          <ItemListSection
            items={addressItems}
            config={GENERATE_LIST_CONFIG}
            copyToClipboard={copyToClipboard}
            formatTime={formatTime}
            onUpdateNotes={handleUpdateAddressNotes}
            onDeleteItem={handleDeleteAddress}
            onClearAll={handleClearAllAddresses}
            onUpdateTags={handleUpdateAddressTags}
            allTags={allTags}
          />
        </>
      )}

      {activeTab === 'send' && (
        <>
          <ReverseAliasSection>
            <InstructionsToggle onClick={() => setShowInstructions(prev => !prev)}>
              <MdInfo size={14} />
              {showInstructions ? '隐藏' : '使用方法'}
            </InstructionsToggle>

            {showInstructions && (
              <>
                <ReverseAliasSteps>
                  <li>输入收件人邮箱并点击 <strong>转换</strong></li>
                  <li>将结果作为 <strong>收件人</strong> 粘贴到邮件客户端的“收件人”栏</li>
                  <li>使用与你的 DDG 账户关联的邮箱发送</li>
                </ReverseAliasSteps>
                <LearnMoreLink
                  href="https://duckduckgo.com/duckduckgo-help-pages/email-protection/duck-addresses/how-do-i-compose-a-new-email"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  了解更多 <MdOpenInNew size={12} />
                </LearnMoreLink>
              </>
            )}

            {addresses.length > 0 && (
              <SenderSelector onClick={() => { setShowAliasPicker(true); setPickerSearch(''); }}>
                <span>发件人：</span>
                <span>{(effectiveSender || userData?.user.username) + '@duck.com'}</span>
                <MdKeyboardArrowDown size={18} />
              </SenderSelector>
            )}

            <ReverseAliasInputRow>
              <ReverseAliasInput
                type="email"
                placeholder="someone@email.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConvertReverseAlias(e);
                }}
              />
              <ReverseAliasConvertButton
                onClick={handleConvertReverseAlias}
                disabled={!recipientEmail.trim().includes("@")}
              >
                Convert
              </ReverseAliasConvertButton>
            </ReverseAliasInputRow>
          </ReverseAliasSection>

          {neverSaveAddresses && (
            <HistoryNotice>
              <MdInfo size={14} />
              Send addresses are copied but not saved
            </HistoryNotice>
          )}

          {showAliasPicker && (
            <DialogOverlay onClick={(e) => { if (e.target === e.currentTarget) { setShowAliasPicker(false); setPickerSearch(''); } }}>
              <PickerContainer>
                <PickerHeader>
                  <h3>发送账户</h3>
                  <button aria-label="关闭选择器" title="关闭" onClick={() => { setShowAliasPicker(false); setPickerSearch(''); }}>
                    <MdClose size={20} />
                  </button>
                </PickerHeader>
                <PickerSearchInput
                  placeholder="搜索地址……"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  autoFocus
                />
                <PickerList>
                  <PickerItem
                    active={!effectiveSender}
                    onClick={() => { setSelectedSender(null); setShowAliasPicker(false); setPickerSearch(''); }}
                  >
                    <PickerItemText>
                      {userData?.user.username}@duck.com
                      {!effectiveSender && <MdCheck size={14} style={{ marginLeft: 6, verticalAlign: 'middle' }} />}
                    </PickerItemText>
                    <PickerItemLabel>个人地址</PickerItemLabel>
                  </PickerItem>
                  {filteredPickerAddresses.map(addr => (
                    <PickerItem
                      key={addr.value}
                      active={effectiveSender === addr.value}
                      onClick={() => { setSelectedSender(addr.value); setShowAliasPicker(false); setPickerSearch(''); }}
                    >
                      <PickerItemText>
                        {addr.value}@duck.com
                        {effectiveSender === addr.value && <MdCheck size={14} style={{ marginLeft: 6, verticalAlign: 'middle' }} />}
                      </PickerItemText>
                      {addr.notes && <PickerItemLabel>{addr.notes}</PickerItemLabel>}
                    </PickerItem>
                  ))}
                </PickerList>
              </PickerContainer>
            </DialogOverlay>
          )}
          <ItemListSection
            items={reverseAliasItems}
            config={SEND_LIST_CONFIG}
            copyToClipboard={copyToClipboard}
            formatTime={formatTime}
            onUpdateNotes={handleUpdateReverseAliasNotes}
            onDeleteItem={handleDeleteReverseAlias}
            onClearAll={handleClearAllReverseAliases}
            autoEditKey={autoEditAlias}
            onAutoEditComplete={() => setAutoEditAlias(null)}
            onUpdateTags={handleUpdateReverseAliasTags}
            allTags={allTags}
          />
        </>
      )}

      <NotificationRenderer />
    </DashboardContainer>
  );
};
