import { useState, useEffect } from 'react';
import {
  Box, List, ListItem, ListItemButton, ListItemIcon, Typography,
  IconButton, Tooltip, alpha, Divider, Avatar,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AddIcon from '@mui/icons-material/Add';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import TravelExploreIcon from '@mui/icons-material/TravelExplore';
import CampaignIcon from '@mui/icons-material/Campaign';
import QuizIcon from '@mui/icons-material/Quiz';
import CodeIcon from '@mui/icons-material/Code';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import SettingsIcon from '@mui/icons-material/Settings';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import TokenIcon from '@mui/icons-material/Token';
import ScheduleIcon from '@mui/icons-material/Schedule';
import ContactsIcon from '@mui/icons-material/Contacts';
import AssignmentIcon from '@mui/icons-material/Assignment';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import AceSpadeIcon from './AceSpadeIcon';
import { BRAND } from '../theme';

const SIDEBAR_WIDTH = 240;
const COLLAPSED_WIDTH = 56;

const toolItems = [
  { id: 'pipeline', text: 'Pipeline', icon: <AccountTreeIcon sx={{ fontSize: 20 }} /> },
  { id: 'contacts', text: 'Contacts', icon: <ContactsIcon sx={{ fontSize: 20 }} /> },
  { id: 'sops', text: 'Processes', icon: <AssignmentIcon sx={{ fontSize: 20 }} /> },
  { id: 'research', text: 'Deep Research', icon: <TravelExploreIcon sx={{ fontSize: 20 }} /> },
  { id: 'social', text: 'Social Media', icon: <CampaignIcon sx={{ fontSize: 20 }} /> },
  { id: 'forms', text: 'Forms', icon: <QuizIcon sx={{ fontSize: 20 }} /> },
  { id: 'studio', text: 'Code Studio', icon: <CodeIcon sx={{ fontSize: 20 }} /> },
  { id: 'books', text: 'Books', icon: <MenuBookIcon sx={{ fontSize: 20 }} /> },
  { id: 'automation', text: 'Scheduled Tasks', icon: <ScheduleIcon sx={{ fontSize: 20 }} /> },
  { id: 'workload', text: 'Media & Files', icon: <FolderOpenIcon sx={{ fontSize: 20 }} /> },
];

export default function Sidebar({
  conversations = [],
  activeConversationId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  selectedTool,
  onSelectTool,
  collapsed,
  onToggleCollapse,
  credits,
  onOpenSettings,
  onOpenCredits,
  themeMode,
  onToggleTheme,
  isOwner = false,
}) {
  const [hoveredChat, setHoveredChat] = useState(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const width = isMobile ? (collapsed ? 0 : SIDEBAR_WIDTH) : (collapsed ? COLLAPSED_WIDTH : SIDEBAR_WIDTH);

  return (
    <>
      {/* Mobile backdrop — tap to close sidebar */}
      {isMobile && !collapsed && (
        <Box onClick={onToggleCollapse} sx={{
          position: 'fixed', inset: 0, zIndex: 1199,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(2px)',
        }} />
      )}

      {/* Mobile hamburger button — visible when sidebar is collapsed on mobile */}
      {isMobile && collapsed && (
        <IconButton onClick={onToggleCollapse} sx={{
          position: 'fixed', top: 12, left: 12, zIndex: 1200,
          width: 40, height: 40,
          background: BRAND.bgCard,
          border: `1px solid ${BRAND.border}`,
          color: BRAND.textSecondary,
          '&:hover': { background: BRAND.bgSurface },
        }}>
          <MenuIcon sx={{ fontSize: 20 }} />
        </IconButton>
      )}

      <Box sx={{
        width, minWidth: width, maxWidth: width,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: BRAND.bgSidebar,
        borderRight: `1px solid ${BRAND.border}`,
        transition: 'width 0.25s ease, min-width 0.25s ease, max-width 0.25s ease',
        overflow: 'hidden',
        ...(isMobile && !collapsed && {
          position: 'fixed', left: 0, top: 0, zIndex: 1200,
          boxShadow: '4px 0 20px rgba(0,0,0,0.5)',
        }),
      }}>
      {/* Logo + New Chat */}
      <Box sx={{ p: collapsed ? '12px 8px' : '16px 14px 8px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {/* Logo row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: collapsed ? 0 : 0.5, justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <Avatar sx={{
            width: 28, height: 28,
            background: BRAND.primary,
          }}>
            <AceSpadeIcon sx={{ fontSize: 15 }} />
          </Avatar>
          {!collapsed && (
            <Typography sx={{
              fontSize: '0.95rem', fontWeight: 700, letterSpacing: '-0.01em',
              color: BRAND.textPrimary,
            }}>
              OpenAce
            </Typography>
          )}
          {!collapsed && (
            <IconButton size="small" onClick={onToggleCollapse}
              sx={{ ml: 'auto', color: BRAND.textMuted, p: 0.5, '&:hover': { color: BRAND.textSecondary } }}>
              <KeyboardArrowLeftIcon sx={{ fontSize: 18 }} />
            </IconButton>
          )}
        </Box>

        {/* New Chat button */}
        <Tooltip title={collapsed ? 'New Chat' : ''} placement="right">
          <Box
            onClick={onNewChat}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1,
              px: collapsed ? 0 : 1.5, py: 0.8,
              borderRadius: 2,
              cursor: 'pointer',
              justifyContent: collapsed ? 'center' : 'flex-start',
              border: `1px solid ${BRAND.border}`,
              '&:hover': { background: alpha(BRAND.primary, 0.08), borderColor: BRAND.borderLight },
              transition: 'all 0.15s ease',
            }}
          >
            <AddIcon sx={{ fontSize: 18, color: BRAND.textSecondary }} />
            {!collapsed && (
              <>
                <Typography sx={{ fontSize: '0.82rem', color: BRAND.textSecondary, fontWeight: 500, flex: 1 }}>
                  New Chat
                </Typography>
                <Typography sx={{ fontSize: '0.65rem', color: BRAND.textMuted, fontWeight: 500, opacity: 0.6 }}>
                  &#8984;K
                </Typography>
              </>
            )}
          </Box>
        </Tooltip>
      </Box>

      {/* Tools Section — only visible to authenticated owner */}
      {isOwner && <Box sx={{ py: 0.5 }}>
        <List disablePadding>
          {toolItems.map((item) => (
            <ListItem key={item.id} disablePadding>
              <Tooltip title={collapsed ? item.text : ''} placement="right">
                <ListItemButton
                  selected={selectedTool === item.id}
                  onClick={() => onSelectTool(item.id)}
                  sx={{
                    minHeight: 36, py: 0.6,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    px: collapsed ? 1 : 1.5,
                    gap: 1.2,
                  }}
                >
                  <ListItemIcon sx={{
                    minWidth: 0, color: selectedTool === item.id ? BRAND.primaryLight : BRAND.textMuted,
                    transition: 'color 0.15s',
                  }}>
                    {item.icon}
                  </ListItemIcon>
                  {!collapsed && (
                    <Typography sx={{
                      fontSize: '0.82rem', fontWeight: selectedTool === item.id ? 600 : 400,
                      color: selectedTool === item.id ? BRAND.textPrimary : BRAND.textSecondary,
                    }}>
                      {item.text}
                    </Typography>
                  )}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          ))}
        </List>
      </Box>}

      {isOwner && <Divider sx={{ mx: collapsed ? 1 : 2, borderColor: BRAND.border }} />}

      {/* Chats Section */}
      <Box sx={{ flex: 1, overflow: 'auto', py: 1 }}>
        {!collapsed && (
          <Typography sx={{
            px: 2, py: 0.5, fontSize: '0.7rem', fontWeight: 600,
            color: BRAND.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            Chats
          </Typography>
        )}
        <List disablePadding>
          {conversations.map((conv) => (
            <ListItem key={conv.id} disablePadding
              onMouseEnter={() => setHoveredChat(conv.id)}
              onMouseLeave={() => setHoveredChat(null)}
            >
              <Tooltip title={collapsed ? (conv.title || 'Chat') : ''} placement="right">
                <ListItemButton
                  selected={activeConversationId === conv.id}
                  onClick={() => onSelectConversation(conv.id)}
                  sx={{
                    py: 0.6, minHeight: 34,
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    px: collapsed ? 1 : 1.5,
                  }}
                >
                  {!collapsed ? (
                    <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography noWrap sx={{ fontSize: '0.8rem', flex: 1, color: BRAND.textSecondary }}>
                        {conv.title || 'New chat'}
                      </Typography>
                      {hoveredChat === conv.id && onDeleteConversation && (
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDeleteConversation(conv.id); }}
                          sx={{ p: 0.3, color: BRAND.textMuted, '&:hover': { color: BRAND.error } }}>
                          <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                        </IconButton>
                      )}
                    </Box>
                  ) : (
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: BRAND.textMuted }} />
                  )}
                </ListItemButton>
              </Tooltip>
            </ListItem>
          ))}
        </List>
      </Box>

      {/* Bottom Section */}
      <Box sx={{ p: collapsed ? 1 : 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {/* Credits — owner only */}
        {isOwner && credits !== null && credits !== undefined && (
          <Tooltip title={collapsed ? `${credits} credits` : ''} placement="right">
            <Box
              onClick={onOpenCredits}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                px: collapsed ? 0 : 1, py: 0.5,
                borderRadius: 1.5, cursor: 'pointer',
                justifyContent: collapsed ? 'center' : 'flex-start',
                '&:hover': { background: alpha(BRAND.primary, 0.08) },
              }}
            >
              <TokenIcon sx={{ fontSize: 18, color: BRAND.primaryLight }} />
              {!collapsed && (
                <Typography sx={{ fontSize: '0.75rem', color: BRAND.textSecondary }}>
                  {credits} credits
                </Typography>
              )}
            </Box>
          </Tooltip>
        )}

        {/* Theme toggle */}
        <Tooltip title={collapsed ? (themeMode === 'dark' ? 'Light mode' : 'Dark mode') : ''} placement="right">
          <Box
            onClick={onToggleTheme}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1,
              px: collapsed ? 0 : 1, py: 0.5,
              borderRadius: 1.5, cursor: 'pointer',
              justifyContent: collapsed ? 'center' : 'flex-start',
              '&:hover': { background: alpha(BRAND.primary, 0.08) },
            }}
          >
            {themeMode === 'dark'
              ? <LightModeIcon sx={{ fontSize: 18, color: BRAND.textMuted }} />
              : <DarkModeIcon sx={{ fontSize: 18, color: BRAND.textMuted }} />
            }
            {!collapsed && (
              <Typography sx={{ fontSize: '0.75rem', color: BRAND.textSecondary }}>
                {themeMode === 'dark' ? 'Light mode' : 'Dark mode'}
              </Typography>
            )}
          </Box>
        </Tooltip>

        {/* Settings — owner only */}
        {isOwner && <Tooltip title={collapsed ? 'Settings' : ''} placement="right">
          <Box
            onClick={onOpenSettings}
            sx={{
              display: 'flex', alignItems: 'center', gap: 1,
              px: collapsed ? 0 : 1, py: 0.5,
              borderRadius: 1.5, cursor: 'pointer',
              justifyContent: collapsed ? 'center' : 'flex-start',
              '&:hover': { background: alpha(BRAND.primary, 0.08) },
            }}
          >
            <SettingsIcon sx={{ fontSize: 18, color: BRAND.textMuted }} />
            {!collapsed && (
              <Typography sx={{ fontSize: '0.75rem', color: BRAND.textSecondary }}>
                Settings
              </Typography>
            )}
          </Box>
        </Tooltip>}

        {/* Collapse toggle (when collapsed) */}
        {collapsed && (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 0.5 }}>
            <IconButton size="small" onClick={onToggleCollapse}
              sx={{ color: BRAND.textMuted, '&:hover': { color: BRAND.textSecondary } }}>
              <KeyboardArrowRightIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        )}
      </Box>
    </Box>
    </>
  );
}
