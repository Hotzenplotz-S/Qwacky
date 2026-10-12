import React from 'react';
import { MdHome, MdFormatListBulleted, MdSend } from 'react-icons/md';
import { TabsContainer, Tab } from '../styles/DashboardTabs.styles';

export type DashboardTab = 'home' | 'addresses' | 'send';

interface DashboardTabsProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
}

const TABS: Array<{ id: DashboardTab; label: string; icon: React.ReactNode }> = [
  { id: 'home', label: '首页', icon: <MdHome /> },
  { id: 'addresses', label: '地址', icon: <MdFormatListBulleted /> },
  { id: 'send', label: '发送', icon: <MdSend /> }
];

export const DashboardTabs: React.FC<DashboardTabsProps> = ({ activeTab, onTabChange }) => {
  return (
    <TabsContainer role="tablist">
      {TABS.map(tab => (
        <Tab
          key={tab.id}
          active={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
          aria-selected={activeTab === tab.id}
          role="tab"
        >
          {tab.icon} {tab.label}
        </Tab>
      ))}
    </TabsContainer>
  );
};
